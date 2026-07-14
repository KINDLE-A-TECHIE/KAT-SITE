import { fail, ok } from "@/lib/http";
import { drainWebhooks } from "@/lib/school-webhook";
import { captureError } from "@/lib/sentry";

/**
 * Drains the webhook outbox. Secured by Authorization: Bearer <CRON_SECRET>.
 *
 * Deliveries are queued in-request and sent here, because on serverless the invocation is torn down
 * the moment the response is sent, an in-request retry loop dies silently, and a slow school
 * endpoint would become OUR latency on a child's lesson completion.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET not configured.", 500);

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return fail("Unauthorized", 401);

  try {
    const result = await drainWebhooks();
    return ok(result);
  } catch (error) {
    captureError(error);
    return fail("Drain failed.", 500);
  }
}
