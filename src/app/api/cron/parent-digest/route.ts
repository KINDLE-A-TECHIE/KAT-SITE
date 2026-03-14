import "server-only";
import { UserRole } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildParentDigestEmail } from "@/lib/email";

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

// Called once a month by an external cron service (e.g. Vercel Cron, GitHub Actions).
// Secured by Authorization: Bearer <CRON_SECRET>.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET not configured.", 500);

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return fail("Unauthorized", 401);

  const now = new Date();
  // Last calendar month
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Load all parent→child links
  const parentLinks = await prisma.parentStudent.findMany({
    select: {
      parentId: true,
      childId: true,
      parent: {
        select: { email: true, firstName: true, isActive: true },
      },
      child: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
    where: { parent: { isActive: true } },
  });

  // Group links by parent
  type LinkEntry = (typeof parentLinks)[number];
  const byParent = new Map<string, { email: string; firstName: string; children: LinkEntry[] }>();
  for (const link of parentLinks) {
    if (!byParent.has(link.parentId)) {
      byParent.set(link.parentId, {
        email: link.parent.email,
        firstName: link.parent.firstName,
        children: [],
      });
    }
    byParent.get(link.parentId)!.children.push(link);
  }

  let sent = 0;
  let skipped = 0;

  for (const [, parent] of byParent) {
    const childDigests = await Promise.all(
      parent.children.map(async (link) => {
        const child = link.child;

        const [enrollments, lastMonthSubmissions, overdueAssessments, upcomingMeetings] =
          await Promise.all([
            // Programs this child is enrolled in
            prisma.enrollment.findMany({
              where: { userId: child.id },
              select: {
                program: { select: { id: true, name: true } },
              },
            }),
            // Their submissions last month
            prisma.assessmentSubmission.findMany({
              where: {
                studentId: child.id,
                submittedAt: { gte: monthStart, lt: monthEnd },
              },
              select: {
                totalScore: true,
                assessment: { select: { passScore: true, programId: true } },
              },
            }),
            // Overdue published assessments with no submission
            prisma.assessment.count({
              where: {
                published: true,
                dueDate: { lt: now },
                program: { enrollments: { some: { userId: child.id } } },
                submissions: { none: { studentId: child.id } },
              },
            }),
            // Upcoming meetings
            prisma.meetingParticipant.count({
              where: {
                userId: child.id,
                meeting: { startTime: { gte: now } },
              },
            }),
          ]);

        // Build per-program stats
        const subsByProgram = new Map<string, typeof lastMonthSubmissions>();
        for (const sub of lastMonthSubmissions) {
          const pid = sub.assessment.programId;
          if (!subsByProgram.has(pid)) subsByProgram.set(pid, []);
          subsByProgram.get(pid)!.push(sub);
        }

        const programs = enrollments.map((e) => {
          const pSubs = subsByProgram.get(e.program.id) ?? [];
          const scoredSubs = pSubs.filter((s) => s.totalScore !== null);
          const avgScore =
            scoredSubs.length === 0
              ? null
              : roundToOneDecimal(
                  scoredSubs.reduce((sum, s) => sum + Number(s.totalScore), 0) / scoredSubs.length,
                );

          const passableSubs = pSubs.filter((s) => s.assessment.passScore !== null);
          const passRate =
            passableSubs.length === 0
              ? null
              : roundToOneDecimal(
                  (passableSubs.filter(
                    (s) => Number(s.totalScore) >= Number(s.assessment.passScore),
                  ).length /
                    passableSubs.length) *
                    100,
                );

          return {
            programName: e.program.name,
            submissionsLastMonth: pSubs.length,
            avgScore,
            passRate,
          };
        });

        return {
          firstName: child.firstName,
          lastName: child.lastName,
          programs,
          overdueAssessments,
          upcomingMeetings,
        };
      }),
    );

    // Only send if there's at least some data worth reporting
    const hasAnyActivity = childDigests.some(
      (c) => c.programs.some((p) => p.submissionsLastMonth > 0) || c.overdueAssessments > 0,
    );

    if (!hasAnyActivity) {
      skipped++;
      continue;
    }

    const { html, text } = buildParentDigestEmail({
      parentFirstName: parent.firstName,
      month: monthLabel,
      children: childDigests,
    });

    await sendEmail({
      to: parent.email,
      subject: `KAT Academy — ${monthLabel} Progress Report`,
      html,
      text,
    });

    sent++;
  }

  return ok({ sent, skipped, month: monthLabel });
}

// Also allow GET for manual trigger from dashboard (admin only can call with correct secret)
export { POST as GET };
