import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 20 executions per user per minute, using a sliding window
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url:   process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        prefix: "kat:run",
      })
    : null;

interface Params { params: Promise<{ contentId: string }> }

// Judge0 CE language IDs — https://github.com/judge0/judge0/blob/master/docs/api/languages.md
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  python:     71,  // Python 3
  javascript: 63,  // Node.js
  typescript: 74,  // TypeScript
  java:       62,  // Java (OpenJDK)
  c:          50,  // C (GCC)
  cpp:        54,  // C++ (GCC)
  go:         60,  // Go
  rust:       73,  // Rust
  php:        68,  // PHP
  ruby:       72,  // Ruby
  csharp:     51,  // C# (Mono)
};

const JUDGE0_API_URL = process.env.JUDGE0_API_URL?.replace(/\/$/, "") ?? null;
// Optional — self-hosted Judge0 CE instances typically have no auth by default
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY?.trim() ?? null;

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  // Per-user rate limit: 20 runs/minute
  if (ratelimit) {
    const { success, limit, remaining, reset } = await ratelimit.limit(session.user.id);
    if (!success) {
      const retryAfterSecs = Math.ceil((reset - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ error: `Too many requests. Try again in ${retryAfterSecs}s.` }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit":     String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "Retry-After":           String(retryAfterSecs),
          },
        },
      );
    }
  }

  const { contentId } = await params;

  const content = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { type: true, language: true, reviewStatus: true },
  });

  if (!content) return fail("Content not found.", 404);
  if (content.type !== "CODE_PLAYGROUND") return fail("Not a code playground.", 400);
  if (!content.language) return fail("No language set for this playground.", 400);

  // Learners can only run published content
  const role = session.user.role;
  if ((role === "STUDENT" || role === "FELLOW") && content.reviewStatus !== "PUBLISHED") {
    return fail("Content not published.", 403);
  }

  const body = await request.json() as { code?: string; stdin?: string };
  if (!body.code || typeof body.code !== "string") return fail("code is required.", 400);
  if (body.code.length > 50_000) return fail("Code too long (max 50 000 chars).", 400);

  const languageId = JUDGE0_LANGUAGE_MAP[content.language];
  if (!languageId) return fail(`Unsupported language: ${content.language}`, 400);

  if (!JUDGE0_API_URL) {
    return fail("Code execution service is not configured.", 503);
  }

  // Build auth headers — omit X-Auth-Token entirely for self-hosted instances without auth
  const authHeaders: Record<string, string> = JUDGE0_API_KEY
    ? { "X-Auth-Token": JUDGE0_API_KEY }
    : {};

  const submissionBody = JSON.stringify({
    source_code: body.code,
    language_id: languageId,
    stdin: body.stdin ?? "",
  });

  try {
    type Judge0Result = {
      stdout:         string | null;
      stderr:         string | null;
      compile_output: string | null;
      exit_code:      number | null;
      status:         { id: number; description: string };
      time:           string | null;
      memory:         number | null;
    };

    // Attempt synchronous execution first (requires ENABLE_WAIT_RESULT=true on self-hosted)
    let result: Judge0Result | null = null;

    const waitRes = await fetch(`${JUDGE0_API_URL}/submissions?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: submissionBody,
      signal: AbortSignal.timeout(15_000),
    });

    if (waitRes.ok) {
      result = await waitRes.json() as Judge0Result;
    } else if (waitRes.status === 400) {
      // wait=true not enabled — fall back to async polling
      let detail = "";
      try { detail = await waitRes.text(); } catch { /* ignore */ }
      console.warn(`[run] wait=true rejected (${waitRes.status}): ${detail} — falling back to polling`);

      const createRes = await fetch(`${JUDGE0_API_URL}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: submissionBody,
        signal: AbortSignal.timeout(10_000),
      });

      if (!createRes.ok) {
        let d = "";
        try { d = await createRes.text(); } catch { /* ignore */ }
        console.error(`[run] Judge0 create ${createRes.status}: ${d}`);
        return fail(`Code execution service error (${createRes.status}).`, 502);
      }

      const { token } = await createRes.json() as { token: string };

      // Poll up to 10 times with 1 s intervals (10 s total)
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const pollRes = await fetch(
          `${JUDGE0_API_URL}/submissions/${token}?fields=stdout,stderr,compile_output,exit_code,status,time,memory`,
          { headers: authHeaders, signal: AbortSignal.timeout(5_000) },
        );
        if (!pollRes.ok) continue;
        const polled = await pollRes.json() as Judge0Result;
        // Status IDs 1 (In Queue) and 2 (Processing) mean not yet done
        if (polled.status.id !== 1 && polled.status.id !== 2) {
          result = polled;
          break;
        }
      }

      if (!result) return fail("Execution timed out.", 504);
    } else {
      let detail = "";
      try { detail = await waitRes.text(); } catch { /* ignore */ }
      console.error(`[run] Judge0 ${waitRes.status}: ${detail}`);
      return fail(`Code execution service error (${waitRes.status}).`, 502);
    }

    // Status IDs: 3 = Accepted, 6 = Compilation Error, 5 = TLE, 7-12 = Runtime errors
    const exitCode = result.status.id === 3 ? 0 : 1;

    return ok({
      stdout:        result.stdout        ?? "",
      stderr:        result.stderr        ?? "",
      compileOutput: result.compile_output ?? "",
      exitCode,
      status:        result.status.description,
      time:          result.time,
      memory:        result.memory,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return fail("Execution timed out.", 504);
    }
    return fail("Failed to reach code execution service.", 502);
  }
}
