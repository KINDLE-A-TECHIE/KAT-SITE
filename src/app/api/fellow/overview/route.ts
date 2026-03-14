import { MeetingStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.FELLOW) return fail("Forbidden", 403);

  const now = new Date();
  const fellowId = session.user.id;
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [mentorships, upcomingMeetings, unreadMessages, pendingSubmissions, application] =
    await Promise.all([
      // Active mentees
      prisma.mentorship.findMany({
        where: { fellowId, active: true },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              enrollments: {
                where: { status: "ACTIVE" },
                select: { program: { select: { name: true } } },
                take: 1,
              },
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      }),

      // Upcoming meetings hosted by this fellow (next 30 days)
      prisma.meeting.findMany({
        where: {
          hostId: fellowId,
          status: MeetingStatus.UPCOMING,
          startTime: { gte: now, lte: thirtyDaysFromNow },
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          dailyRoomUrl: true,
        },
        orderBy: { startTime: "asc" },
        take: 5,
      }),

      // Unread messages
      prisma.message.count({
        where: {
          thread: { participants: { some: { userId: fellowId } } },
          senderId: { not: fellowId },
          receipts: { none: { userId: fellowId } },
        },
      }),

      // Assessment submissions not yet graded (for fellow's mentees)
      prisma.assessmentSubmission.count({
        where: {
          gradedAt: null,
          enrollment: {
            user: {
              studentMentorships: { some: { fellowId, active: true } },
            },
          },
        },
      }),

      // Fellow's approved application (cohort info)
      prisma.fellowApplication.findFirst({
        where: { applicantId: fellowId, status: "APPROVED" },
        select: {
          cohort: { select: { id: true, name: true, startsAt: true, endsAt: true } },
        },
        orderBy: { reviewedAt: "desc" },
      }),
    ]);

  return ok({
    mentees: mentorships.map((m) => ({
      id: m.student.id,
      firstName: m.student.firstName,
      lastName: m.student.lastName,
      email: m.student.email,
      assignedAt: m.assignedAt,
      program: m.student.enrollments[0]?.program?.name ?? null,
    })),
    upcomingMeetings: upcomingMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      startTime: m.startTime,
      endTime: m.endTime,
      joinUrl: m.dailyRoomUrl,
    })),
    pendingSubmissions,
    unreadMessages,
    cohort: application?.cohort ?? null,
  });
}
