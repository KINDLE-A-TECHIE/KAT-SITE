import { AttemptStatus, EnrollmentStatus, PaymentStatus, UserRole } from "@prisma/client";
import { prisma } from "./prisma";

type TrackEventInput = {
  userId?: string;
  organizationId?: string | null;
  eventType: string;
  eventName: string;
  payload?: unknown;
};

type UserTrendPoint = {
  date: string;
  label: string;
  logins: number;
  submissions: number;
  messagesReceived: number;
  meetingsJoined: number;
};

type PlatformTrendPoint = {
  date: string;
  label: string;
  newEnrollments: number;
  revenue: number;
  activityEvents: number;
  messagesSent: number;
};

type RiskAlert = {
  userId: string;
  name: string;
  role: UserRole;
  unreadMessages: number;
  upcomingMeetings: number;
  lastLoginDaysAgo: number | null;
  overdueAssessments: number;
  passRate: number | null;
  daysSinceLastSubmission: number | null;
  riskScore: number;
};

type AssessmentProgramStat = {
  programId: string;
  programName: string;
  totalAssessments: number;
  totalSubmissions: number;
  passRate: number | null;
  avgScore: number | null;
  pendingGrading: number;
};

type CohortLeaderboardItem = {
  cohortId: string;
  name: string;
  programName: string;
  enrollments: number;
  completionRate: number;
  meetingAttendanceRate: number;
  revenue: number;
};

type ProgramLeaderboardItem = {
  programId: string;
  name: string;
  enrollments: number;
  completed: number;
  completionRate: number;
  revenue: number;
};

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildDateRange(rangeDays: number) {
  const end = startOfUtcDay(new Date());
  const keys: string[] = [];
  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - offset);
    keys.push(day.toISOString().slice(0, 10));
  }
  const start = new Date(`${keys[0]}T00:00:00.000Z`);
  return { start, keys };
}

function keyFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function labelFromDateKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function daysSince(value: Date) {
  return Math.floor((Date.now() - value.getTime()) / (24 * 60 * 60 * 1000));
}

function scoreRisk(input: {
  unreadMessages: number;
  upcomingMeetings: number;
  lastLoginDaysAgo: number | null;
  overdueAssessments: number;
  passRate: number | null;
  daysSinceLastSubmission: number | null;
  role: UserRole;
}) {
  let score = 0;

  // Unread messages
  if (input.unreadMessages >= 10) {
    score += 5;
  } else if (input.unreadMessages >= 5) {
    score += 3;
  } else if (input.unreadMessages > 0) {
    score += 1;
  }

  // Upcoming meetings — fellows are in scheduled cohorts so 0 meetings is a strong signal
  if (input.upcomingMeetings === 0) {
    score += input.role === UserRole.FELLOW ? 3 : 1;
  }

  // Login inactivity
  if (input.lastLoginDaysAgo === null) {
    score += 5;
  } else if (input.lastLoginDaysAgo >= 14) {
    score += 4;
  } else if (input.lastLoginDaysAgo >= 7) {
    score += 3;
  } else if (input.lastLoginDaysAgo >= 3) {
    score += 1;
  }

  // Overdue assessments — missed deadlines
  if (input.overdueAssessments >= 3) {
    score += 4;
  } else if (input.overdueAssessments >= 1) {
    score += 2;
  }

  // Academic performance — low pass rate
  if (input.passRate !== null) {
    if (input.passRate < 40) {
      score += 4;
    } else if (input.passRate < 60) {
      score += 2;
    } else if (input.passRate < 75) {
      score += 1;
    }
  }

  // Academic inactivity — days since last submission
  // Students can register at any time; fellows have a cohort schedule.
  // Both benefit from submission recency checks.
  if (input.daysSinceLastSubmission !== null) {
    if (input.daysSinceLastSubmission >= 30) {
      score += 3;
    } else if (input.daysSinceLastSubmission >= 14) {
      score += 2;
    } else if (input.daysSinceLastSubmission >= 7) {
      score += 1;
    }
  }

  return score;
}

export async function trackEvent(input: TrackEventInput) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId ?? undefined,
        eventType: input.eventType,
        eventName: input.eventName,
        payload: input.payload as object | undefined,
      },
    });
  } catch {
    // Analytics should never break business routes.
  }
}

export async function getUserAnalytics(userId: string, rangeDays = 30) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { start: trendStart, keys } = buildDateRange(rangeDays);
  const resolvedRole =
    (
      await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })
    )?.role ?? UserRole.STUDENT;

  const activityLabelByRole: Record<UserRole, string> = {
    SUPER_ADMIN: "Messages Sent",
    ADMIN: "Messages Sent",
    INSTRUCTOR: "Assessments Created",
    FELLOW: "Assessments Submitted",
    STUDENT: "Assessments Submitted",
    PARENT: "Linked Students",
  };

  const activityLabel = activityLabelByRole[resolvedRole];

  const activityCountPromise =
    resolvedRole === UserRole.INSTRUCTOR
      ? prisma.assessment.count({
          where: { createdById: userId },
        })
      : resolvedRole === UserRole.PARENT
        ? prisma.parentStudent.count({
            where: { parentId: userId },
          })
        : resolvedRole === UserRole.ADMIN || resolvedRole === UserRole.SUPER_ADMIN
          ? prisma.message.count({
              where: { senderId: userId },
            })
          : prisma.assessmentSubmission.count({
              where: { studentId: userId },
            });

  const activityEventsInRangePromise: Promise<Date[]> =
    resolvedRole === UserRole.INSTRUCTOR
      ? prisma.assessment
          .findMany({
            where: {
              createdById: userId,
              createdAt: { gte: trendStart },
            },
            select: { createdAt: true },
          })
          .then((rows) => rows.map((row) => row.createdAt))
      : resolvedRole === UserRole.PARENT
        ? prisma.parentStudent
            .findMany({
              where: {
                parentId: userId,
                createdAt: { gte: trendStart },
              },
              select: { createdAt: true },
            })
            .then((rows) => rows.map((row) => row.createdAt))
        : resolvedRole === UserRole.ADMIN || resolvedRole === UserRole.SUPER_ADMIN
          ? prisma.message
              .findMany({
                where: {
                  senderId: userId,
                  createdAt: { gte: trendStart },
                },
                select: { createdAt: true },
              })
              .then((rows) => rows.map((row) => row.createdAt))
          : prisma.assessmentSubmission
              .findMany({
                where: {
                  studentId: userId,
                  submittedAt: { gte: trendStart },
                },
                select: { submittedAt: true },
              })
              .then((rows) => rows.map((row) => row.submittedAt));

  const [logins, activityCount, unreadMessages, upcomingMeetings, loginEventsInRange, activityEventsInRange, messagesInRange, meetingsInRange] =
    await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          userId,
          eventType: "auth",
          eventName: "login",
          occurredAt: { gte: thirtyDaysAgo },
        },
      }),
      activityCountPromise,
      prisma.message.count({
        where: {
          thread: {
            participants: { some: { userId } },
          },
          senderId: { not: userId },
          receipts: {
            none: { userId },
          },
        },
      }),
      prisma.meetingParticipant.count({
        where: {
          userId,
          meeting: { startTime: { gte: new Date() } },
        },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          userId,
          eventType: "auth",
          eventName: "login",
          occurredAt: { gte: trendStart },
        },
        select: { occurredAt: true },
      }),
      activityEventsInRangePromise,
      prisma.message.findMany({
        where: {
          senderId: { not: userId },
          createdAt: { gte: trendStart },
          thread: {
            participants: {
              some: {
                userId,
                leftAt: null,
              },
            },
          },
        },
        select: { createdAt: true },
      }),
      prisma.meetingParticipant.findMany({
        where: {
          userId,
          joinedAt: { gte: trendStart },
        },
        select: { joinedAt: true },
      }),
    ]);

  const pointsByDate = new Map<string, UserTrendPoint>(
    keys.map((key) => [
      key,
      {
        date: key,
        label: labelFromDateKey(key),
        logins: 0,
        submissions: 0,
        messagesReceived: 0,
        meetingsJoined: 0,
      },
    ]),
  );

  for (const item of loginEventsInRange) {
    const key = keyFromDate(item.occurredAt);
    const point = pointsByDate.get(key);
    if (point) {
      point.logins += 1;
    }
  }

  for (const occurredAt of activityEventsInRange) {
    const key = keyFromDate(occurredAt);
    const point = pointsByDate.get(key);
    if (point) {
      point.submissions += 1;
    }
  }

  for (const item of messagesInRange) {
    const key = keyFromDate(item.createdAt);
    const point = pointsByDate.get(key);
    if (point) {
      point.messagesReceived += 1;
    }
  }

  for (const item of meetingsInRange) {
    if (!item.joinedAt) {
      continue;
    }
    const key = keyFromDate(item.joinedAt);
    const point = pointsByDate.get(key);
    if (point) {
      point.meetingsJoined += 1;
    }
  }

  return {
    loginStats30d: logins,
    activityLabel,
    assessmentsSubmitted: activityCount,
    unreadMessages,
    upcomingMeetings,
    trends: {
      rangeDays,
      points: keys.map((key) => pointsByDate.get(key)!),
    },
  };
}

export async function getPlatformAnalytics(organizationId: string, rangeDays = 30) {
  const trend = buildDateRange(rangeDays);

  const [
    users,
    enrollments,
    successfulPayments,
    recentEvents,
    enrollmentsInRange,
    successfulPaymentsInRange,
    activityEventsInRange,
    messagesInRange,
    monitoredUsers,
    cohorts,
    programs,
    cohortRevenueRows,
    programRevenueRows,
    programAssessmentRows,
    gradingBacklog,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.enrollment.count({
      where: {
        program: { organizationId },
      },
    }),
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        user: { organizationId },
      },
      select: { amount: true, billingMonth: true },
    }),
    prisma.analyticsEvent.count({
      where: {
        organizationId,
        occurredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.enrollment.findMany({
      where: {
        program: { organizationId },
        createdAt: { gte: trend.start },
      },
      select: { createdAt: true },
    }),
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        user: { organizationId },
        initializedAt: { gte: trend.start },
      },
      select: { amount: true, initializedAt: true },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: trend.start },
      },
      select: { occurredAt: true },
    }),
    prisma.message.findMany({
      where: {
        createdAt: { gte: trend.start },
        thread: {
          participants: {
            some: {
              user: { organizationId },
            },
          },
        },
      },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [UserRole.STUDENT, UserRole.FELLOW, UserRole.INSTRUCTOR] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      take: 80,
    }),
    prisma.cohort.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        program: { select: { name: true } },
        enrollments: { select: { status: true } },
        meetings: {
          select: {
            participants: {
              select: { joinedAt: true },
            },
          },
        },
      },
      take: 50,
    }),
    prisma.program.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        enrollments: { select: { status: true } },
      },
      take: 50,
    }),
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        user: { organizationId },
        enrollment: { cohortId: { not: null } },
      },
      select: {
        amount: true,
        enrollment: {
          select: {
            cohortId: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        user: { organizationId },
        programId: { not: null },
      },
      select: {
        amount: true,
        programId: true,
      },
    }),
    // Assessment analytics: per-program stats
    prisma.program.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        assessments: {
          where: { published: true },
          select: {
            passScore: true,
            totalPoints: true,
            submissions: {
              select: {
                totalScore: true,
                status: true,
                gradedAt: true,
              },
            },
          },
        },
      },
      take: 20,
    }),
    // Grading backlog: submitted but not yet graded
    prisma.assessmentSubmission.count({
      where: {
        assessment: { program: { organizationId }, published: true },
        status: AttemptStatus.SUBMITTED,
        gradedAt: null,
      },
    }),
  ]);

  const roleBreakdown = users.reduce<Record<UserRole, number>>(
    (acc, row) => {
      acc[row.role] = row._count._all;
      return acc;
    },
    {
      SUPER_ADMIN: 0,
      ADMIN: 0,
      INSTRUCTOR: 0,
      FELLOW: 0,
      STUDENT: 0,
      PARENT: 0,
    },
  );

  const totalRevenue = successfulPayments.reduce((sum, payment) => {
    return sum + Number(payment.amount);
  }, 0);

  const platformTrendByDate = new Map<string, PlatformTrendPoint>(
    trend.keys.map((key) => [
      key,
      {
        date: key,
        label: labelFromDateKey(key),
        newEnrollments: 0,
        revenue: 0,
        activityEvents: 0,
        messagesSent: 0,
      },
    ]),
  );

  for (const item of enrollmentsInRange) {
    const key = keyFromDate(item.createdAt);
    const point = platformTrendByDate.get(key);
    if (point) {
      point.newEnrollments += 1;
    }
  }

  for (const item of successfulPaymentsInRange) {
    const key = keyFromDate(item.initializedAt);
    const point = platformTrendByDate.get(key);
    if (point) {
      point.revenue += Number(item.amount);
    }
  }

  for (const item of activityEventsInRange) {
    const key = keyFromDate(item.occurredAt);
    const point = platformTrendByDate.get(key);
    if (point) {
      point.activityEvents += 1;
    }
  }

  for (const item of messagesInRange) {
    const key = keyFromDate(item.createdAt);
    const point = platformTrendByDate.get(key);
    if (point) {
      point.messagesSent += 1;
    }
  }

  const latestLoginByUserId = new Map<string, Date>();
  if (monitoredUsers.length > 0) {
    const loginEvents = await prisma.analyticsEvent.findMany({
      where: {
        userId: { in: monitoredUsers.map((user) => user.id) },
        eventType: "auth",
        eventName: "login",
      },
      orderBy: { occurredAt: "desc" },
      select: {
        userId: true,
        occurredAt: true,
      },
    });
    for (const event of loginEvents) {
      if (event.userId && !latestLoginByUserId.has(event.userId)) {
        latestLoginByUserId.set(event.userId, event.occurredAt);
      }
    }
  }

  const riskAlerts: RiskAlert[] = (
    await Promise.all(
      monitoredUsers.map(async (user) => {
        const now = new Date();
        const [unreadMessages, upcomingMeetings, recentSubmissions, overdueAssessments] = await Promise.all([
          prisma.message.count({
            where: {
              senderId: { not: user.id },
              thread: {
                participants: {
                  some: {
                    userId: user.id,
                    leftAt: null,
                  },
                },
              },
              receipts: {
                none: {
                  userId: user.id,
                },
              },
            },
          }),
          prisma.meetingParticipant.count({
            where: {
              userId: user.id,
              meeting: { startTime: { gte: now } },
            },
          }),
          // Assessment performance: recent submissions with pass/fail data
          prisma.assessmentSubmission.findMany({
            where: { studentId: user.id },
            select: {
              totalScore: true,
              submittedAt: true,
              assessment: { select: { passScore: true } },
            },
            orderBy: { submittedAt: "desc" },
            take: 20,
          }),
          // Overdue assessments: past-due published assessments the user never submitted
          prisma.assessment.count({
            where: {
              published: true,
              dueDate: { lt: now },
              program: { enrollments: { some: { userId: user.id } } },
              submissions: { none: { studentId: user.id } },
            },
          }),
        ]);

        // Pass rate from graded submissions
        const gradedSubs = recentSubmissions.filter(
          (s) => s.totalScore !== null && s.assessment.passScore !== null,
        );
        const passRate =
          gradedSubs.length === 0
            ? null
            : roundToOneDecimal(
                (gradedSubs.filter(
                  (s) => Number(s.totalScore) >= Number(s.assessment.passScore),
                ).length /
                  gradedSubs.length) *
                  100,
              );

        const lastSub = recentSubmissions[0];
        const daysSinceLastSubmission = lastSub ? daysSince(lastSub.submittedAt) : null;

        const lastLoginAt = latestLoginByUserId.get(user.id);
        const lastLoginDaysAgo = lastLoginAt ? daysSince(lastLoginAt) : null;
        const riskScore = scoreRisk({
          unreadMessages,
          upcomingMeetings,
          lastLoginDaysAgo,
          overdueAssessments,
          passRate,
          daysSinceLastSubmission,
          role: user.role,
        });

        if (riskScore === 0) {
          return null;
        }

        return {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          unreadMessages,
          upcomingMeetings,
          lastLoginDaysAgo,
          overdueAssessments,
          passRate,
          daysSinceLastSubmission,
          riskScore,
        };
      }),
    )
  )
    .filter((item): item is RiskAlert => Boolean(item))
    .sort((a, b) => b.riskScore - a.riskScore || b.unreadMessages - a.unreadMessages)
    .slice(0, 8);

  const revenueByCohortId = new Map<string, number>();
  for (const row of cohortRevenueRows) {
    const cohortId = row.enrollment?.cohortId;
    if (!cohortId) {
      continue;
    }
    revenueByCohortId.set(cohortId, (revenueByCohortId.get(cohortId) ?? 0) + Number(row.amount));
  }

  const cohortLeaderboard: CohortLeaderboardItem[] = cohorts
    .map((cohort) => {
      const enrollmentCount = cohort.enrollments.length;
      const completed = cohort.enrollments.filter(
        (enrollment) => enrollment.status === EnrollmentStatus.COMPLETED,
      ).length;
      const completionRate =
        enrollmentCount === 0 ? 0 : roundToOneDecimal((completed / enrollmentCount) * 100);

      const participantTotal = cohort.meetings.reduce((sum, meeting) => sum + meeting.participants.length, 0);
      const participantJoined = cohort.meetings.reduce(
        (sum, meeting) => sum + meeting.participants.filter((participant) => participant.joinedAt).length,
        0,
      );
      const meetingAttendanceRate =
        participantTotal === 0 ? 0 : roundToOneDecimal((participantJoined / participantTotal) * 100);

      return {
        cohortId: cohort.id,
        name: cohort.name,
        programName: cohort.program.name,
        enrollments: enrollmentCount,
        completionRate,
        meetingAttendanceRate,
        revenue: Number(revenueByCohortId.get(cohort.id) ?? 0),
      };
    })
    .sort(
      (a, b) =>
        b.completionRate - a.completionRate ||
        b.meetingAttendanceRate - a.meetingAttendanceRate ||
        b.revenue - a.revenue,
    )
    .slice(0, 8);

  // Assessment analytics per program
  const assessmentProgramStats: AssessmentProgramStat[] = programAssessmentRows.map((program) => {
    const allSubmissions = program.assessments.flatMap((a) => a.submissions);
    const totalAssessments = program.assessments.length;
    const totalSubmissions = allSubmissions.length;

    const gradedSubmissions = allSubmissions.filter(
      (s) => s.totalScore !== null,
    );
    const avgScore =
      gradedSubmissions.length === 0
        ? null
        : roundToOneDecimal(
            gradedSubmissions.reduce((sum, s) => sum + Number(s.totalScore), 0) /
              gradedSubmissions.length,
          );

    // Pass = totalScore >= passScore on the parent assessment
    let passCount = 0;
    let passableCount = 0;
    for (const assessment of program.assessments) {
      if (assessment.passScore === null) continue;
      const passScore = Number(assessment.passScore);
      for (const sub of assessment.submissions) {
        if (sub.totalScore === null) continue;
        passableCount += 1;
        if (Number(sub.totalScore) >= passScore) passCount += 1;
      }
    }
    const passRate =
      passableCount === 0 ? null : roundToOneDecimal((passCount / passableCount) * 100);

    const pendingGrading = allSubmissions.filter(
      (s) => s.status === AttemptStatus.SUBMITTED && s.gradedAt === null,
    ).length;

    return {
      programId: program.id,
      programName: program.name,
      totalAssessments,
      totalSubmissions,
      passRate,
      avgScore,
      pendingGrading,
    };
  });

  const revenueByProgramId = new Map<string, number>();
  for (const row of programRevenueRows) {
    if (!row.programId) {
      continue;
    }
    revenueByProgramId.set(row.programId, (revenueByProgramId.get(row.programId) ?? 0) + Number(row.amount));
  }

  const programLeaderboard: ProgramLeaderboardItem[] = programs
    .map((program) => {
      const enrollmentCount = program.enrollments.length;
      const completed = program.enrollments.filter(
        (enrollment) => enrollment.status === EnrollmentStatus.COMPLETED,
      ).length;
      const completionRate =
        enrollmentCount === 0 ? 0 : roundToOneDecimal((completed / enrollmentCount) * 100);
      return {
        programId: program.id,
        name: program.name,
        enrollments: enrollmentCount,
        completed,
        completionRate,
        revenue: Number(revenueByProgramId.get(program.id) ?? 0),
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate || b.revenue - a.revenue || b.enrollments - a.enrollments)
    .slice(0, 8);

  return {
    roleBreakdown,
    enrollmentCount: enrollments,
    totalRevenue,
    activityEvents7d: recentEvents,
    trends: {
      rangeDays,
      points: trend.keys.map((key) => platformTrendByDate.get(key)!),
    },
    riskAlerts,
    cohortLeaderboard,
    programLeaderboard,
    assessmentAnalytics: {
      programStats: assessmentProgramStats,
      gradingBacklog,
    },
  };
}
