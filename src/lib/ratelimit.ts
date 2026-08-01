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

/** Lesson note image upload presigned URL: 40 per hour per author */
export const contentUploadLimiter = makeLimiter(40, "1 h", "kat:content:upload");

/** Feedback submission: 60 per hour per user */
export const projectFeedbackLimiter = makeLimiter(60, "1 h", "kat:projects:feedback");

/** Status update (review): 100 per hour per user */
export const projectStatusLimiter = makeLimiter(100, "1 h", "kat:projects:status");

/** Enrollment chat agent: 30 messages per hour per IP */
export const enrollmentChatLimiter = makeLimiter(30, "1 h", "kat:chat:enrollment");

/** Payments. */
export const paymentInitLimiter = makeLimiter(10, "1 h", "kat:payments:init");
export const paymentVerifyLimiter = makeLimiter(20, "1 h", "kat:payments:verify");

/** Messaging + webhooks. */
export const messageSendLimiter = makeLimiter(10, "10 s", "kat:messages:send");
export const webhookLimiter = makeLimiter(120, "1 m", "kat:webhook");

/** Partner / pilot enquiries. */
export const partnerInquiryLimiter = makeLimiter(5, "1 h", "kat:partners:inquiry");

/** Embed launch-token minting, keyed on the API-key prefix. A stolen key must not be usable to farm
 *  launch tokens for an entire school's roster in one pass. */
export const embedTokenLimiter = makeLimiter(120, "1 m", "kat:embed:mint");

/** Redeeming a launch token. Low, because a launch token is single-use and 60s-lived: anything
 *  hammering this is guessing, not launching. */
export const embedRedeemLimiter = makeLimiter(20, "1 m", "kat:embed:redeem");

/** Public v1 API, keyed on the API KEY (not the IP): a school behind one NAT must not rate-limit
 *  itself, and a stolen key must not be usable from a botnet to multiply its own quota. */
export const apiV1Limiter = makeLimiter(600, "1 m", "kat:api:v1");

/** Pupil PIN attempts, keyed on (class code, pupil). A coarse ceiling on top of the per-pupil DB
 *  lockout, so a 6-digit PIN cannot be walked in a burst. */
export const studentPinLimiter = makeLimiter(10, "5 m", "kat:auth:student-pin");

/** Reading a class roster behind a join code (the pre-login "pick your name" step). Bounds how fast
 *  a guessed code can be probed for the names it unlocks. */
export const studentRosterLimiter = makeLimiter(30, "5 m", "kat:auth:student-roster");

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
