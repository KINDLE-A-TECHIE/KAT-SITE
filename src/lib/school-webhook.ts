import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { prisma } from "./prisma";
import { captureError } from "./sentry";

/**
 * Outbound progress webhooks.
 *
 * SIGNING follows the Standard Webhooks spec (standardwebhooks.com): `webhook-id`,
 * `webhook-timestamp`, `webhook-signature`, HMAC-SHA256 over `id.timestamp.body`, base64. Off-the-
 * shelf verification libraries exist for it, so a school's developer does not hand-roll our bespoke
 * scheme and get it subtly wrong, which, when they get it wrong, they get wrong in the direction
 * of accepting forged events about children.
 *
 * THIN PAYLOADS. Refs only, no names, no emails. The receiver calls the v1 API back for detail.
 * That keeps children's names out of the school's webhook logs, out of their error trackers, and
 * out of transit.
 */

export const WEBHOOK_EVENTS = ["lesson.completed", "assessment.graded"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Consecutive failures before we stop delivering and tell the admin. */
export const MAX_FAILURES = 10;

/** Backoff schedule, in minutes, indexed by attempt. Roughly Stripe's shape, compressed. */
const BACKOFF_MINUTES = [0, 1, 5, 15, 30, 60, 120, 240, 480, 720];

export function generateWebhookSecret(): string {
  return "whsec_" + randomBytes(24).toString("base64url");
}

// ─────────────────────────────────────────────────────────────────── SSRF

/**
 * Refuses a URL we must not POST children's data to.
 *
 * THIS IS THE MOST DANGEROUS INPUT IN THE PRODUCT. A school hands us a URL and we make our server
 * send an authenticated-looking POST to it. Unfiltered, that is a textbook SSRF sink:
 *
 *   http://169.254.169.254/latest/meta-data/  → exfiltrates our cloud instance credentials
 *   http://localhost:5432                     → port-scans and pokes our own database
 *   http://10.0.0.5/admin                     → reaches inside our private network
 *
 * The check is done on the RESOLVED IP, not the hostname string. A blocklist of names is trivially
 * defeated by `evil.com` with an A record pointing at 169.254.169.254, the string looks public and
 * the packet goes to the metadata service.
 *
 * (A determined attacker can still race DNS between this check and the fetch, a TOCTOU rebind. The
 * complete fix is to pin the resolved IP into the connection, which Node's fetch does not expose.
 * Given the URL is set by an authenticated school admin, not an anonymous caller, this is a
 * deliberate, documented limit rather than an oversight.)
 */
export async function assertSafeWebhookUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That is not a valid URL.";
  }

  if (url.protocol !== "https:") {
    return "The webhook URL must use https, pupils' progress must not travel in clear text.";
  }

  const host = url.hostname;

  const addresses: string[] = [];
  if (isIP(host)) {
    addresses.push(host);
  } else {
    try {
      const results = await lookup(host, { all: true });
      addresses.push(...results.map((r) => r.address));
    } catch {
      return "That hostname does not resolve.";
    }
  }

  if (addresses.length === 0) return "That hostname does not resolve.";
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      return "That URL resolves to a private or internal address. Webhook endpoints must be publicly reachable.";
    }
  }

  return null;
}

/** Loopback, link-local (incl. the cloud metadata address), and RFC1918 / unique-local ranges. */
function isPrivateAddress(address: string): boolean {
  const v = isIP(address);

  if (v === 4) {
    const p = address.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // unparseable: refuse
    if (p[0] === 10) return true; // 10.0.0.0/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true; // "this host"
    if (p[0] === 169 && p[1] === 254) return true; // link-local, the cloud metadata service
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16.0.0/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168.0.0/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64.0.0/10
    if (p[0] >= 224) return true; // multicast / reserved
    return false;
  }

  if (v === 6) {
    const a = address.toLowerCase();
    if (a === "::1" || a === "::") return true; // loopback / unspecified
    if (a.startsWith("fc") || a.startsWith("fd")) return true; // unique-local
    if (a.startsWith("fe80")) return true; // link-local
    // IPv4-mapped (::ffff:169.254.169.254), unwrap and re-check, or the filter is bypassed.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true; // not an IP at all: refuse
}

// ─────────────────────────────────────────────────────────────── signing

/** Standard Webhooks: base64 HMAC-SHA256 over `${id}.${timestamp}.${body}`. */
export function signWebhook(id: string, timestamp: number, body: string, secret: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "utf8");
  const mac = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${mac}`;
}

/** Exported for the docs' verification example, and used by our own tests. */
export function verifyWebhook(
  id: string,
  timestamp: number,
  body: string,
  secret: string,
  signature: string,
): boolean {
  const expected = signWebhook(id, timestamp, body, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────── outbox

/**
 * Queues an event. Does NOT deliver, the cron does.
 *
 * Fire-and-forget inside a request does not work on serverless: the invocation is torn down the
 * moment the response is sent, so an in-request retry loop dies silently and the school never hears
 * that a pupil finished a lesson. It also makes a slow school endpoint into OUR latency.
 *
 * Never throws: a webhook must not be able to fail a child's lesson completion.
 */
export async function enqueueWebhook(
  schoolId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const hooks = await prisma.schoolWebhook.findMany({
      where: { schoolId, active: true, disabledAt: null },
      select: { id: true },
    });
    if (hooks.length === 0) return;

    await prisma.webhookDelivery.createMany({
      data: hooks.map((h) => ({
        schoolId,
        webhookId: h.id,
        eventType,
        payload: payload as object,
      })),
    });
  } catch (error) {
    captureError(error);
  }
}

export type DrainResult = { attempted: number; delivered: number; failed: number; disabled: number };

/**
 * Delivers due events. Called by cron.
 *
 * Auto-disables an endpoint after MAX_FAILURES consecutive failures. Stripe does the same, because
 * retrying a dead URL forever buries the live deliveries behind it and nobody notices for a month.
 */
export async function drainWebhooks(limit = 50): Promise<DrainResult> {
  const due = await prisma.webhookDelivery.findMany({
    where: { deliveredAt: null, nextAttempt: { lte: new Date() }, attempts: { lt: MAX_FAILURES } },
    orderBy: { nextAttempt: "asc" },
    take: limit,
    select: { id: true, webhookId: true, eventType: true, payload: true, attempts: true, schoolId: true },
  });

  const result: DrainResult = { attempted: 0, delivered: 0, failed: 0, disabled: 0 };

  for (const delivery of due) {
    const hook = await prisma.schoolWebhook.findUnique({
      where: { id: delivery.webhookId },
      select: { id: true, url: true, secret: true, active: true, disabledAt: true, failures: true },
    });

    // The endpoint was deleted or disabled while this sat in the queue. Drop it rather than retry
    // forever.
    if (!hook || !hook.active || hook.disabledAt) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { deliveredAt: new Date(), lastError: "Endpoint disabled; not delivered." },
      });
      continue;
    }

    result.attempted += 1;

    const body = JSON.stringify({
      id: delivery.id,
      type: delivery.eventType,
      createdAt: new Date().toISOString(),
      data: delivery.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);

    let ok = false;
    let errorText = "";

    try {
      // Re-checked at DELIVERY time, not just at registration. DNS changes; a hostname that was
      // public last week can point at 169.254.169.254 today.
      const unsafe = await assertSafeWebhookUrl(hook.url);
      if (unsafe) throw new Error(unsafe);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "webhook-id": delivery.id,
          "webhook-timestamp": String(timestamp),
          "webhook-signature": signWebhook(delivery.id, timestamp, body, hook.secret),
        },
        body,
        // A redirect could bounce us from a public URL to an internal one AFTER the SSRF check.
        redirect: "manual",
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      ok = res.status >= 200 && res.status < 300;
      if (!ok) errorText = `HTTP ${res.status}`;
    } catch (error) {
      errorText = error instanceof Error ? error.message : "delivery failed";
    }

    if (ok) {
      result.delivered += 1;
      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { deliveredAt: new Date(), attempts: { increment: 1 }, lastError: null },
        }),
        prisma.schoolWebhook.update({ where: { id: hook.id }, data: { failures: 0 } }),
      ]);
      continue;
    }

    result.failed += 1;
    const attempts = delivery.attempts + 1;
    const backoff = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
    const failures = hook.failures + 1;
    const shouldDisable = failures >= MAX_FAILURES;
    if (shouldDisable) result.disabled += 1;

    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          lastError: errorText.slice(0, 500),
          nextAttempt: new Date(Date.now() + backoff * 60_000),
        },
      }),
      prisma.schoolWebhook.update({
        where: { id: hook.id },
        data: {
          failures, ...(shouldDisable ? { active: false, disabledAt: new Date() } : {}),
        },
      }),
    ]);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────── emitters

/**
 * Emits `lesson.completed` if the learner is a school pupil.
 *
 * Lives here, not at the call sites, because a lesson can be completed in TWO places, the shared
 * curriculum route and the embed, and an emitter copy-pasted into one of them is a webhook that
 * silently misses half the events. B2C learners have no schoolId and no webhook: they short-circuit.
 *
 * THIN PAYLOAD: refs only. No name, no email. The school calls the v1 API back for detail, so a
 * child's name never lands in their webhook logs.
 *
 * Never throws, a webhook must not be able to fail a child's lesson completion.
 */
export async function emitLessonCompleted(userId: string, lessonId: string): Promise<void> {
  try {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, schoolId: { not: null } },
      select: { schoolId: true, externalRef: true, schoolClassId: true },
    });
    if (!enrollment?.schoolId) return; // B2C learner, nothing to emit

    await enqueueWebhook(enrollment.schoolId, "lesson.completed", {
      student_id: enrollment.externalRef,
      class_id: enrollment.schoolClassId,
      lesson_id: lessonId,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    captureError(error);
  }
}

/** Emits `assessment.graded` if the student is a school pupil. Thin payload; never throws. */
export async function emitAssessmentGraded(
  userId: string,
  submissionId: string,
  assessmentId: string,
  score: number,
): Promise<void> {
  try {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, schoolId: { not: null } },
      select: { schoolId: true, externalRef: true, schoolClassId: true },
    });
    if (!enrollment?.schoolId) return;

    await enqueueWebhook(enrollment.schoolId, "assessment.graded", {
      student_id: enrollment.externalRef,
      class_id: enrollment.schoolClassId,
      submission_id: submissionId,
      assessment_id: assessmentId,
      score,
      graded_at: new Date().toISOString(),
    });
  } catch (error) {
    captureError(error);
  }
}
