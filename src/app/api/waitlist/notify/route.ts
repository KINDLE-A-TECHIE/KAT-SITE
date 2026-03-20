import "server-only";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail, buildWaitlistCohortNotificationEmail } from "@/lib/email";

// POST /api/waitlist/notify  { cohortId }
// Emails every un-notified waitlist entry and marks them as notified.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return fail("Forbidden", 403);
  }

  const { cohortId } = await request.json() as { cohortId: string };
  if (!cohortId) return fail("Missing cohortId", 400);

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      program: { select: { id: true, name: true } },
    },
  });

  if (!cohort) return fail("Cohort not found", 404);

  // Only email those not yet notified
  const pending = await prisma.waitlistEntry.findMany({
    where: { notifiedAt: null },
    select: { id: true, email: true },
  });

  if (pending.length === 0) {
    return ok({ sent: 0, message: "All waitlist entries have already been notified." });
  }

  const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const enrollUrl = `${BASE_URL}/register`;
  const startsAt = cohort.startsAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let sent = 0;
  const now = new Date();

  for (const entry of pending) {
    const { html, text } = buildWaitlistCohortNotificationEmail({
      email: entry.email,
      cohortName: cohort.name,
      programName: cohort.program?.name ?? "KAT Learning",
      startsAt,
      enrollUrl,
    });

    const delivered = await sendEmail({
      to: entry.email,
      subject: `${cohort.program?.name ?? "A new cohort"} is now open for enrolment 🎉`,
      html,
      text,
    });

    if (delivered) {
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { notifiedAt: now },
      });
      sent++;
    }
  }

  return ok({ sent, total: pending.length });
}
