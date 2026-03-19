import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildPartnerEnquiryNotificationEmail } from "@/lib/email";
import { PartnerType } from "@prisma/client";

const PARTNER_NOTIFY_EMAIL = "hello@kindleatechie.com";

const VALID_TYPES = new Set<string>(Object.values(PartnerType));

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, organization, type, email, phone, message } = body as Record<string, string>;

  if (!name?.trim() || !organization?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "name, organization, email, and message are required" }, { status: 400 });
  }

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid partner type" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const inquiry = await prisma.partnerInquiry.create({
    data: {
      name: name.trim(),
      organization: organization.trim(),
      type: type as PartnerType,
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      message: message.trim(),
    },
  });

  const { html, text } = buildPartnerEnquiryNotificationEmail({
    name: inquiry.name,
    organization: inquiry.organization,
    type: inquiry.type,
    email: inquiry.email,
    phone: inquiry.phone,
    message: inquiry.message,
  });

  await sendEmail({
    to: PARTNER_NOTIFY_EMAIL,
    replyTo: inquiry.email,
    subject: `Partnership enquiry from ${inquiry.name} — ${inquiry.organization}`,
    html,
    text,
  });

  return NextResponse.json({ ok: true });
}
