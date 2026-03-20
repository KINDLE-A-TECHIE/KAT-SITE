import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildWaitlistConfirmationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email ?? "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const existing = await prisma.waitlistEntry.findUnique({ where: { email } });

    await prisma.waitlistEntry.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    // Only send confirmation on first-time signup
    if (!existing) {
      const { html, text } = buildWaitlistConfirmationEmail({ email });
      await sendEmail({
        to: email,
        subject: "You're on the KAT Learning waitlist 🎉",
        html,
        text,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
