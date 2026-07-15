import { NextResponse } from "next/server";
import { z } from "zod";
import { SchoolApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, authorizeV1 } from "@/lib/api-v1";
import { assertSafeWebhookUrl, generateWebhookSecret, WEBHOOK_EVENTS } from "@/lib/school-webhook";
import { captureError } from "@/lib/sentry";

/**
 * Progress webhook registration.
 *
 * Requires PROGRESS_READ: registering a webhook is a way to READ progress continuously, so it must
 * not be available to a key that could not read progress by polling.
 *
 * TENANT ISOLATION: schoolId from the key; every query filtered by it.
 */
const postSchema = z.object({ url: z.string().trim().min(1).max(2000) });
const deleteSchema = z.object({ id: z.string().trim().min(1).max(64) });

export async function GET(request: Request) {
  const auth = await authorizeV1(request, SchoolApiScope.PROGRESS_READ);
  if (auth instanceof NextResponse) return auth;
  const { schoolId } = auth.caller;

  try {
    const hooks = await prisma.schoolWebhook.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      // NEVER the secret. It is shown once, at creation, like an API key.
      select: { id: true, url: true, active: true, failures: true, disabledAt: true, createdAt: true },
    });
    return apiOk({ data: hooks, events: WEBHOOK_EVENTS });
  } catch (error) {
    captureError(error);
    return apiError("Could not list webhooks.", 500, "internal_error");
  }
}

export async function POST(request: Request) {
  const auth = await authorizeV1(request, SchoolApiScope.PROGRESS_READ);
  if (auth instanceof NextResponse) return auth;
  const { schoolId } = auth.caller;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON.", 400, "invalid_json");
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload.", 400, "invalid_payload");

  try {
    // SSRF. This URL is one our own server will POST to, so an unfiltered value could reach the
    // cloud metadata service or our private network. Checked against the RESOLVED IP, not the
    // hostname string.
    const unsafe = await assertSafeWebhookUrl(parsed.data.url);
    if (unsafe) return apiError(unsafe, 422, "unsafe_url");

    const secret = generateWebhookSecret();
    const hook = await prisma.schoolWebhook.create({
      data: { schoolId, url: parsed.data.url, secret },
      select: { id: true, url: true, active: true, createdAt: true },
    });

    // The only time the secret exists outside the school's systems.
    return apiOk({ ...hook, secret, events: WEBHOOK_EVENTS }, 201);
  } catch (error) {
    captureError(error);
    return apiError("Could not register the webhook.", 500, "internal_error");
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeV1(request, SchoolApiScope.PROGRESS_READ);
  if (auth instanceof NextResponse) return auth;
  const { schoolId } = auth.caller;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON.", 400, "invalid_json");
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload.", 400, "invalid_payload");

  try {
    // schoolId in the WHERE clause: another school's webhook matches zero rows.
    await prisma.schoolWebhook.deleteMany({ where: { id: parsed.data.id, schoolId } });
    return apiOk({ deleted: true });
  } catch (error) {
    captureError(error);
    return apiError("Could not delete the webhook.", 500, "internal_error");
  }
}
