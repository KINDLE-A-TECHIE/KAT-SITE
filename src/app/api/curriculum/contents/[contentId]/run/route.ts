import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runOnJudge0 } from "@/lib/judge0";

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

  const body = await request.json() as { code?: string; stdin?: string; additional_files?: string };
  if (!body.code || typeof body.code !== "string") return fail("code is required.", 400);
  if (body.code.length > 50_000) return fail("Code too long (max 50 000 chars).", 400);
  if (body.additional_files && typeof body.additional_files !== "string") {
    return fail("additional_files must be a base64 string.", 400);
  }

  const outcome = await runOnJudge0({
    language: content.language,
    code: body.code,
    stdin: body.stdin,
    additionalFiles: body.additional_files,
  });
  if (!outcome.ok) return fail(outcome.error, outcome.status);
  return ok(outcome.result);
}
