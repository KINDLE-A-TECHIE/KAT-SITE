import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function makeRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function makeLimiter(windowReqs: number, window: string, prefix: string) {
  const redis = makeRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(windowReqs, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    prefix,
  });
}

/** Login: 10 attempts per 15 minutes per email address */
export const loginLimiter = makeLimiter(10, "15 m", "kat:auth:login");

/** Forgot-password: 3 requests per 15 minutes per IP */
export const forgotPasswordLimiter = makeLimiter(3, "15 m", "kat:auth:forgot");

/** Registration: 5 requests per hour per IP */
export const registerLimiter = makeLimiter(5, "1 h", "kat:auth:register");

/** Project creation: 10 per hour per user */
export const projectCreateLimiter = makeLimiter(10, "1 h", "kat:projects:create");

/** File upload presigned URL: 30 per hour per user */
export const projectUploadLimiter = makeLimiter(30, "1 h", "kat:projects:upload");

/** Feedback submission: 60 per hour per user */
export const projectFeedbackLimiter = makeLimiter(60, "1 h", "kat:projects:feedback");

/** Status update (review): 100 per hour per user */
export const projectStatusLimiter = makeLimiter(100, "1 h", "kat:projects:status");

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function rateLimitResponse(reset: number): Response {
  const retryAfterSecs = Math.ceil((reset - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSecs),
      },
    },
  );
}
