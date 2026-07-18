import "server-only";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { SchoolApiScope } from "@prisma/client";
import { prisma } from "./prisma";
import { apiKeyFromRequest, authenticateApiKey, hasScope, type ApiCaller } from "./school-api-key";
import { apiV1Limiter } from "./ratelimit";

/**
 * The v1 request pipeline: authenticate → scope → rate-limit → (idempotency).
 *
 * One chokepoint on purpose. Four separate route files each remembering four steps is four chances
 * to forget one, and the thing being forgotten here guards children's records. `authorizeV1()` is
 * the ONLY way into a v1 handler, and it returns either a caller or a Response, so a handler that
 * ignores it does not compile.
 *
 * TENANT ISOLATION: schoolId comes from the KEY. Never from a path, query, or body. A v1 route that
 * reads a schoolId from the request is a cross-school breach, and the security harness fails the
 * build for it.
 */

export const API_VERSION = "1";

/** Consistent error envelope, matching the app's `{ error }` convention. */
export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function apiOk<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: { "X-KAT-Api-Version": API_VERSION, ...headers },
  });
}

export type Authorized = { caller: ApiCaller };

/**
 * Authenticates the key, checks the scope, and rate-limits.
 *
 * Returns a Response on failure, the caller must return it. Deliberately NOT a throwing guard:
 * a `try/catch` around a handler could swallow it, and a swallowed authorization failure is an
 * open door.
 */
export async function authorizeV1(
  request: Request,
  scope: SchoolApiScope,
): Promise<Authorized | NextResponse> {
  const rawKey = apiKeyFromRequest(request);
  const caller = await authenticateApiKey(rawKey);

  if (!caller) {
    // Same answer for absent, malformed, unknown and REVOKED. A caller learns only "not valid".
    return apiError("Invalid or revoked API key.", 401, "unauthorized");
  }

  if (!hasScope(caller, scope)) {
    // Named explicitly: an integrator staring at a 403 needs to know which scope to add, and the
    // scope name is not a secret.
    return apiError(
      `This key does not have the ${scope} scope.`,
      403,
      "insufficient_scope",
    );
  }

  /*
   * FAIL CLOSED IN PRODUCTION.
   *
   * makeLimiter() returns null when UPSTASH_* is unset, and every other route in the app then
   * silently skips rate limiting. That is a sane default for a dashboard. It is NOT a sane default
   * for a PUBLIC API whose ROSTER_WRITE scope creates child accounts: a missing environment
   * variable would quietly remove the only thing standing between us and an unbounded write loop,
   * and nothing anywhere would say so.
   *
   * An unmetered public API that can create children is worse than a temporarily unavailable one.
   */
  if (!apiV1Limiter && process.env.NODE_ENV === "production") {
    return apiError(
      "The API is temporarily unavailable.",
      503,
      "rate_limiter_unavailable",
    );
  }

  // Keyed on the KEY, not the IP: a school behind one NAT must not rate-limit itself, and a stolen
  // key must not be usable to hammer us from a botnet.
  if (apiV1Limiter) {
    const { success, reset } = await apiV1Limiter.limit(`v1:${caller.keyId}`);
    if (!success) {
      // Re-wrapped rather than reusing rateLimitResponse, which returns a plain Response that 12
      // other routes depend on. `Retry-After` is not decoration: without it an integrator's retry
      // loop guesses, and guesses badly.
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  return { caller };
}

// ─────────────────────────────────────────────────────────── idempotency

export type Replay = { replayed: true; response: NextResponse };

/**
 * Idempotency for unsafe requests (Stripe's `Idempotency-Key` pattern).
 *
 * A school syncing 400 children over a flaky link WILL retry a request that actually succeeded.
 * Without this, that retry is a duplicate-children incident.
 *
 * The BODY IS HASHED into the record: the same key with a different body is a bug on the caller's
 * side and gets a 422, rather than silently replaying an unrelated response, which would be worse
 * than either honest outcome.
 */
export async function checkIdempotency(
  request: Request,
  schoolId: string,
  rawBody: string,
): Promise<Replay | { replayed: false; key: string | null; bodyHash: string }> {
  const key = request.headers.get("idempotency-key")?.trim() || null;
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");

  if (!key) return { replayed: false, key: null, bodyHash };

  const existing = await prisma.apiIdempotencyKey.findUnique({
    where: { schoolId_key: { schoolId, key } },
    select: { bodyHash: true, status: true, response: true },
  });

  if (!existing) return { replayed: false, key, bodyHash };

  if (existing.bodyHash !== bodyHash) {
    return {
      replayed: true,
      response: apiError(
        "This Idempotency-Key was already used with a different request body.",
        422,
        "idempotency_key_reuse",
      ),
    };
  }

  return {
    replayed: true,
    response: apiOk(existing.response, existing.status, { "Idempotent-Replay": "true" }),
  };
}

/** Records the outcome so a retry replays it. Never allowed to fail the request it just completed. */
export async function saveIdempotency(
  schoolId: string,
  key: string | null,
  bodyHash: string,
  status: number,
  response: unknown,
): Promise<void> {
  if (!key) return;
  try {
    await prisma.apiIdempotencyKey.create({
      data: { schoolId, key, bodyHash, status, response: response as object },
    });
  } catch {
    // A concurrent identical request won the unique constraint. That is the feature working.
  }
}

// ─────────────────────────────────────────────────────────── pagination
// The cursor-pagination convention now lives in one place (src/lib/pagination.ts) so the v1
// API and the rest of the app cannot drift apart. Re-exported for existing v1 imports.
export { PAGE_DEFAULT, PAGE_MAX, readPaging } from "@/lib/pagination";
