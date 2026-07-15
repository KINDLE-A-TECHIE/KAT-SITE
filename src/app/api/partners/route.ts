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

  const { name, organization, type, email, phone, message, programs } = body as Record<string, unknown>;

  if (!String(name ?? "").trim() || !String(organization ?? "").trim() || !String(email ?? "").trim() || !String(message ?? "").trim()) {
    return NextResponse.json({ error: "name, organization, email, and message are required" }, { status: 400 });
  }

  if (!VALID_TYPES.has(String(type))) {
    return NextResponse.json({ error: "Invalid partner type" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const programList = Array.isArray(programs) ? programs.filter((p): p is string => typeof p === "string") : [];

  const inquiry = await prisma.partnerInquiry.create({
    data: {
      name: String(name).trim(),
      organization: String(organization).trim(),
      type: String(type) as PartnerType,
      email: String(email).trim().toLowerCase(),
      phone: String(phone ?? "").trim() || null,
      programs: programList,
      message: String(message).trim(),
    },
  });

  const { html, text } = buildPartnerEnquiryNotificationEmail({
    name: inquiry.name,
    organization: inquiry.organization,
    type: inquiry.type,
    email: inquiry.email,
    phone: inquiry.phone,
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

  return NextResponse.json({ ok: true });
}
