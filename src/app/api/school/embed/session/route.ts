import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/http";
import { cookies } from "next/headers";
import { EMBED_COOKIE, buildEmbedCookie, mintLaunchToken, readEmbedSession, redeemLaunchToken } from "@/lib/school-embed";
import { embedRedeemLimiter, getClientIp, rateLimitResponse } from "@/lib/ratelimit";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/school/embed/session, spend a launch token, receive an embed session cookie.
 *
 * Called by the embed page itself, from inside the iframe, with the token it read out of the URL
 * FRAGMENT. The token is in the body, never in a query string: query strings land in access logs,
 * browser history, and `Referer` headers, and this token is a key to a child's session.
 *
 * The schoolSlug comes from the path the iframe was loaded at, and redeemLaunchToken checks it
 * against the token's own schoolId, so a token for school A cannot be redeemed at school B's URL.
 */

const bodySchema = z.object({
  token: z.string().min(1).max(4096),
  schoolSlug: z.string().trim().min(1).max(128),
});

export async function POST(request: Request) {
  if (embedRedeemLimiter) {
    const { success, reset } = await embedRedeemLimiter.limit(getClientIp(request));
    if (!success) return rateLimitResponse(reset);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400);

  try {
    const result = await redeemLaunchToken(parsed.data.token, parsed.data.schoolSlug);
    if (!result.ok) return fail(result.reason, 401);

    /*
     * THE HANDOFF TOKEN, how the Safari fallback is possible at all.
     *
     * We cannot know from the server whether the browser will keep a third-party cookie; it drops
     * one silently, with no error. The client finds out by probing GET below. But by then the launch
     * token is SPENT (single-use, deliberately), so it has nothing left to open a top-level tab with.
     *
     * So we mint one fresh single-use token here and hand it back in the body. The client uses it
     * ONLY if the cookie failed to stick. It never touches a log: it is read by our own same-origin
     * script and passed in a fragment.
     */
    const handoff = await mintLaunchToken(result.claims);

    const response = NextResponse.json({ ok: true, handoff: handoff.token }, { status: 200 });
    response.headers.append(
      "Set-Cookie",
      buildEmbedCookie(result.sessionToken, result.maxAge),
    );
    return response;
  } catch (error) {
    captureError(error);
    return fail("Could not start the session.", 500);
  }
}

/**
 * GET /api/school/embed/session. "did my cookie actually stick?"
 *
 * The embed cookie is HttpOnly, so script cannot read it. A browser that silently drops a
 * third-party cookie reports no error, so the ONLY honest way for the iframe to know is to ask the
 * server whether the request carried one. 200 = yes, 401 = no (and take the top-level fallback).
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = await readEmbedSession(cookieStore.get(EMBED_COOKIE)?.value);
  if (!session) return fail("No embed session.", 401);
  return NextResponse.json({ ok: true });
}
