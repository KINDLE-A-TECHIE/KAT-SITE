import "server-only";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildPaymentReminderEmail } from "@/lib/email";

// Runs daily. Secured by Authorization: Bearer <CRON_SECRET>.
//
// Timeline per billing period:
//   Day  0    — payment verified → currentPeriodEnd = now + 30 days, status = ACTIVE
//   Day 27    — "due in 3 days" warning sent to parent
//   Day 30    — period ends → grace starts, "grace period" warning sent
//   Day 30+4  — grace expires → status = SUSPENDED

const PERIOD_DAYS  = 30;
const GRACE_DAYS   = 4;
const WARN_DAYS    = 3; // days before period end to send first warning

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Returns true if `target` falls within [now + minDays, now + maxDays)
function withinWindow(target: Date, now: Date, minDays: number, maxDays: number) {
  const lo = addDays(now, minDays).getTime();
  const hi = addDays(now, maxDays).getTime();
  return target.getTime() >= lo && target.getTime() < hi;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET not configured.", 500);
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return fail("Unauthorized", 401);

  const now = new Date();
  let warned3day = 0, warnedGrace = 0, suspended = 0;

  // Fetch all active/suspended enrollments that have a billing period set
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "SUSPENDED"] },
      currentPeriodEnd: { not: null },
    },
    select: {
      id: true,
      status: true,
      currentPeriodEnd: true,
      user: {
        select: {
          id: true,
          firstName: true,
          email: true,
          childLinks: {
            select: {
              parent: {
                select: { id: true, firstName: true, email: true },
              },
            },
          },
        },
      },
      program: { select: { name: true, monthlyFee: true } },
    },
  });

  for (const enrollment of enrollments) {
    const periodEnd = enrollment.currentPeriodEnd!;
    const graceEnd  = addDays(periodEnd, GRACE_DAYS);
    const student   = enrollment.user;
    const program   = enrollment.program;
    const amount    = Number(program.monthlyFee ?? 0);
    const payUrl    = `${BASE_URL}/dashboard/payments`;

    // Resolve who to notify: parents if linked, otherwise the student themselves
    const recipients = student.childLinks.length > 0
      ? student.childLinks.map((p) => p.parent)
      : [{ id: student.id, firstName: student.firstName, email: student.email }];

    // Helper: create a notification only if the recipient has no unread one
    // with the same title already (prevents duplicates on repeated cron runs).
    async function notifyIfNew(
      recipientId: string,
      type: "INFO" | "WARNING" | "ERROR" | "SUCCESS",
      title: string,
      text: string,
    ) {
      const exists = await prisma.notification.findFirst({
        where: { recipientId, title, readAt: null },
        select: { id: true },
      });
      if (exists) return;
      await prisma.notification.create({
        data: {
          recipientId,
          type,
          title,
          body: JSON.stringify({ text, targetPath: "/dashboard/payments" }),
        },
      });
    }

    // ── 1. SUSPEND if grace period has expired ─────────────────────────────
    if (enrollment.status === "ACTIVE" && graceEnd <= now) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "SUSPENDED" },
      });

      const title = `Enrolment suspended — ${program.name}`;
      const text  = `${student.firstName}'s access to ${program.name} has been suspended due to non-payment. Pay now to restore access.`;
      for (const r of recipients) {
        await notifyIfNew(r.id, "WARNING", title, text);
        const { html, subject } = buildPaymentReminderEmail({
          parentFirstName: r.firstName,
          childFirstName: student.firstName,
          programName: program.name,
          dueDate: formatDate(periodEnd),
          amount,
          currency: "NGN",
          kind: "suspended",
          payUrl,
        });
        sendEmail({ to: r.email, subject, html }).catch((e: unknown) =>
          console.error("[enrollment-billing] email failed:", e),
        );
      }
      suspended++;
      continue;
    }

    // ── 2. GRACE PERIOD warning (period just ended, grace started today) ───
    if (
      enrollment.status === "ACTIVE" &&
      withinWindow(periodEnd, now, -1, 0)
    ) {
      const title = `4-day grace period started — ${program.name}`;
      const text  = `${student.firstName}'s ${program.name} enrolment expired. You have 4 days to pay before access is suspended.`;
      for (const r of recipients) {
        await notifyIfNew(r.id, "WARNING", title, text);
        const { html, subject } = buildPaymentReminderEmail({
          parentFirstName: r.firstName,
          childFirstName: student.firstName,
          programName: program.name,
          dueDate: formatDate(periodEnd),
          amount,
          currency: "NGN",
          kind: "grace_started",
          payUrl,
        });
        sendEmail({ to: r.email, subject, html }).catch((e: unknown) =>
          console.error("[enrollment-billing] email failed:", e),
        );
      }
      warnedGrace++;
      continue;
    }

    // ── 3. 3-DAY WARNING (period ends in ~3 days) ──────────────────────────
    if (
      enrollment.status === "ACTIVE" &&
      withinWindow(periodEnd, now, WARN_DAYS - 0.5, WARN_DAYS + 0.5)
    ) {
      const title = `Payment due in 3 days — ${program.name}`;
      const text  = `${student.firstName}'s ${program.name} enrolment renews on ${formatDate(periodEnd)}. Pay to avoid disruption.`;
      for (const r of recipients) {
        await notifyIfNew(r.id, "INFO", title, text);
        const { html, subject } = buildPaymentReminderEmail({
          parentFirstName: r.firstName,
          childFirstName: student.firstName,
          programName: program.name,
          dueDate: formatDate(periodEnd),
          amount,
          currency: "NGN",
          kind: "due_soon",
          payUrl,
        });
        sendEmail({ to: r.email, subject, html }).catch((e: unknown) =>
          console.error("[enrollment-billing] email failed:", e),
        );
      }
      warned3day++;
    }
  }

  return ok({
    processed: enrollments.length,
    warned3day,
    warnedGrace,
    suspended,
  });
}
