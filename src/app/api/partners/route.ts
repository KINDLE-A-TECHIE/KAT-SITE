import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildPartnerEnquiryNotificationEmail } from "@/lib/email";
import { partnerInquiryCreateSchema } from "@/lib/validators";
import { partnerInquiryLimiter, getClientIp, rateLimitResponse } from "@/lib/ratelimit";
import { captureError } from "@/lib/sentry";
import { PartnerType } from "@prisma/client";

const PARTNER_NOTIFY_EMAIL = "hello@kindleatechie.com";

export async function POST(req: Request) {
  // Rate-limit per IP (5/hour). No-op when Upstash env is unset, per the shared pattern.
  const ip = getClientIp(req);
  if (partnerInquiryLimiter) {
    const { success, reset } = await partnerInquiryLimiter.limit(ip);
    if (!success) return rateLimitResponse(reset);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = partnerInquiryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    const inquiry = await prisma.partnerInquiry.create({
      data: {
        name: data.name,
        organization: data.organization,
        type: data.type as PartnerType,
        email: data.email,
        phone: data.phone ? data.phone : null,
        state: data.state ? data.state : null,
        estimatedStudents: data.estimatedStudents ?? null,
        message: data.message,
        programs: data.programs ?? [],
      },
    });

    // Notify (best-effort). The lead is already persisted, so a transient mail failure must
    // NOT fail the request, otherwise the school sees an error and resubmits a lead we kept.
    try {
      const { html, text } = buildPartnerEnquiryNotificationEmail({
        name: inquiry.name,
        organization: inquiry.organization,
        type: inquiry.type,
        email: inquiry.email,
        phone: inquiry.phone,
        state: inquiry.state,
        estimatedStudents: inquiry.estimatedStudents,
        programs: inquiry.programs,
        message: inquiry.message,
      });
      await sendEmail({
        to: PARTNER_NOTIFY_EMAIL,
        replyTo: inquiry.email,
        subject: `Partnership enquiry from ${inquiry.name}, ${inquiry.organization}`,
        html,
        text,
      });
    } catch (mailErr) {
      captureError(mailErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    captureError(err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
