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

// Map our language identifiers to Glot.io language slugs
// Full list: https://glot.io/languages
const GLOT_LANGUAGE_MAP: Record<string, { lang: string; file: string }> = {
  python:     { lang: "python",     file: "main.py" },
  javascript: { lang: "javascript", file: "main.js" },
  typescript: { lang: "typescript", file: "main.ts" },
  java:       { lang: "java",       file: "Main.java" },
  c:          { lang: "c",          file: "main.c" },
  cpp:        { lang: "cpp",        file: "main.cpp" },
  go:         { lang: "go",         file: "main.go" },
  rust:       { lang: "rust",       file: "main.rs" },
  php:        { lang: "php",        file: "main.php" },
  ruby:       { lang: "ruby",       file: "main.rb" },
  csharp:     { lang: "csharp",     file: "main.cs" },
};

const GLOT_API_TOKEN = process.env.GLOT_API_TOKEN?.trim() || null;

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
    select: { type: true, language: true, reviewStatus: true, lesson: { select: { module: { select: { version: { select: { curriculum: { select: { programId: true } } } } } } } } },
  });

  if (!content) return fail("Content not found.", 404);
  if (content.type !== "CODE_PLAYGROUND") return fail("Not a code playground.", 400);
  if (!content.language) return fail("No language set for this playground.", 400);

  // Learners can only run published content
  const role = session.user.role;
  if ((role === "STUDENT" || role === "FELLOW") && content.reviewStatus !== "PUBLISHED") {
    return fail("Content not published.", 403);
  }

  const body = await request.json() as { code?: string };
  if (!body.code || typeof body.code !== "string") return fail("code is required.", 400);
  if (body.code.length > 50_000) return fail("Code too long (max 50 000 chars).", 400);

  const glotEntry = GLOT_LANGUAGE_MAP[content.language];
  if (!glotEntry) return fail(`Unsupported language: ${content.language}`, 400);

  if (!GLOT_API_TOKEN) {
    return fail("Code execution service is not configured.", 503);
  }

  try {
    const glotRes = await fetch(`https://glot.io/api/run/${glotEntry.lang}/latest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${GLOT_API_TOKEN}`,
      },
      body: JSON.stringify({
        files: [{ name: glotEntry.file, content: body.code }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!glotRes.ok) {
      let detail = "";
      try { detail = await glotRes.text(); } catch { /* ignore */ }
      console.error(`[run] Glot.io ${glotRes.status}: ${detail}`);
      return fail(`Code execution service error (${glotRes.status}).`, 502);
    }

    const result = await glotRes.json() as {
      stdout?: string;
      stderr?: string;
      error?: string;
    };

    // Glot returns error string for compile/runtime errors — treat as stderr
    const stderr = (result.stderr ?? "") + (result.error ? `\n${result.error}` : "");
    const exitCode = result.error ? 1 : 0;

    return ok({
      stdout: result.stdout ?? "",
      stderr: stderr.trim(),
      exitCode,
      compileOutput: null,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return fail("Execution timed out.", 504);
    }
    return fail("Failed to reach code execution service.", 502);
  }
}