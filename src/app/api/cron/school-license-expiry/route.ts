import "server-only";
import { SchoolLicenseStatus, SchoolRole } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildSchoolLicenseExpiryEmail } from "@/lib/email";
import { formatTerm, termLifecycle, daysUntilTermEnds, termGraceEndsAt } from "@/lib/school-term";
import { SCHOOL_HOST } from "@/lib/school-host";
import { captureError } from "@/lib/sentry";

/**
 * Daily term-licence lifecycle sweep. Secured by Authorization: Bearer <CRON_SECRET>.
 *
 * The 15-week window itself is enforced lazily on every request (school-license.ts), this cron is the
 * PROACTIVE half: it emails a school's admins before a term lapses and once it enters grace, and it
 * reconciles a past-grace licence's stored status to EXPIRED so analytics and the gate agree. It does
 * NOT use the B2C notification bell (deliberately absent from the school product); the channel is
 * email plus the in-app billing banner.
 *
 * Idempotent via SchoolLicense.expiryNoticeStage (0 none, 1 reminder sent, 2 grace notice sent),
 * reset to 0 whenever a term is (re)activated, so it never re-emails the same notice day after day.
 */

const REMIND_WITHIN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET not configured.", 500);
  if ((request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) return fail("Unauthorized", 401);

  const now = new Date();
  // Only ACTIVE licences with a real start date have a window to act on (null start = no time limit).
  const licenses = await prisma.schoolLicense.findMany({
    where: { status: SchoolLicenseStatus.ACTIVE, startsAt: { not: null } },
    select: {
      id: true,
      sessionLabel: true,
      termNumber: true,
      startsAt: true,
      expiryNoticeStage: true,
      school: {
        select: {
          name: true,
          memberships: {
            where: { role: SchoolRole.SCHOOL_ADMIN },
            select: { user: { select: { email: true, isActive: true } } },
          },
        },
      },
    },
  });

  const billingUrl = `https://${SCHOOL_HOST}/admin/billing`;
  let remindersSent = 0;
  let graceNotices = 0;
  let expired = 0;

  for (const lic of licenses) {
    const life = termLifecycle(lic.startsAt, now);
    const term = formatTerm(lic.sessionLabel, lic.termNumber);
    const admins = lic.school.memberships
      .map((m) => m.user)
      .filter((u): u is { email: string; isActive: boolean } => Boolean(u.isActive && u.email))
      .map((u) => u.email);

    async function emailAdmins(kind: "expiring" | "grace", daysLeft: number) {
      for (const to of admins) {
        const { subject, html } = buildSchoolLicenseExpiryEmail({ schoolName: lic.school.name, term, kind, daysLeft, billingUrl });
        await sendEmail({ to, subject, html });
      }
    }

    try {
      if (life === "EXPIRED") {
        // Past grace. Access is already refused by the lazy window check; reconcile the stored status
        // so analytics/the gate agree. If we somehow never sent the grace notice (a cron gap), send it
        // now so the school is not cut off silently.
        if (lic.expiryNoticeStage < 2 && admins.length > 0) {
          await emailAdmins("grace", 0);
        }
        await prisma.schoolLicense.update({
          where: { id: lic.id },
          data: { status: SchoolLicenseStatus.EXPIRED, expiryNoticeStage: 2 },
        });
        expired += 1;
        continue;
      }

      if (life === "GRACE" && lic.expiryNoticeStage < 2) {
        const graceDaysLeft = Math.max(0, Math.ceil((termGraceEndsAt(lic.startsAt)!.getTime() - now.getTime()) / DAY_MS));
        await emailAdmins("grace", graceDaysLeft);
        await prisma.schoolLicense.update({ where: { id: lic.id }, data: { expiryNoticeStage: 2 } });
        graceNotices += 1;
        continue;
      }

      if (life === "ACTIVE" && lic.expiryNoticeStage < 1) {
        const daysLeft = daysUntilTermEnds(lic.startsAt, now);
        if (daysLeft !== null && daysLeft <= REMIND_WITHIN_DAYS) {
          await emailAdmins("expiring", daysLeft);
          await prisma.schoolLicense.update({ where: { id: lic.id }, data: { expiryNoticeStage: 1 } });
          remindersSent += 1;
        }
      }
    } catch (error) {
      // One school's failure must not abort the whole sweep.
      captureError(error, { licenseId: lic.id });
    }
  }

  return ok({ scanned: licenses.length, remindersSent, graceNotices, expired });
}
