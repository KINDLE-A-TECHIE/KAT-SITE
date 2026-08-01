import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get("assessmentId");
  if (!assessmentId) return NextResponse.json({ error: "assessmentId required" }, { status: 400 });

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { type: true, totalPoints: true },
  });

  if (!assessment || (assessment.type as string) !== "CHALLENGE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Top-N distinct students by best attempt. `distinct` keeps the first row per student under the
  // orderBy (highest score, earliest if tied = their best), so it replaces the manual dedup, and
  // take caps the payload: a popular challenge would otherwise return every submission ever made.
  const LEADERBOARD_LIMIT = 100;
  const topSubmissions = await prisma.assessmentSubmission.findMany({
    where: { assessmentId },
    orderBy: [{ totalScore: "desc" }, { submittedAt: "asc" }],
    distinct: ["studentId"],
    take: LEADERBOARD_LIMIT,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: { select: { avatarUrl: true } },
        },
      },
    },
  });

  const leaderboard = topSubmissions.map((s, i) => ({
    rank: i + 1,
    studentId: s.student.id,
    firstName: s.student.firstName,
    lastName: s.student.lastName,
    avatarUrl: s.student.profile?.avatarUrl ?? null,
    score: s.totalScore,
    totalPoints: assessment.totalPoints,
    submittedAt: s.submittedAt.toISOString(),
    isCurrentUser: s.student.id === session.user.id,
  }));

  const inList = leaderboard.find((e) => e.isCurrentUser);
  let currentUserRank: number | null = inList?.rank ?? null;
  let currentUserEntry = inList ?? null;
  if (!inList) {
    const mine = await prisma.assessmentSubmission.findFirst({
      where: { assessmentId, studentId: session.user.id },
      orderBy: [{ totalScore: "desc" }, { submittedAt: "asc" }],
      select: {
        totalScore: true,
        submittedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, profile: { select: { avatarUrl: true } } } },
      },
    });
    if (mine) {
      const myScore = mine.totalScore ?? 0;
      // Distinct students whose BEST score beats mine (this board ranks distinct students).
      const better = await prisma.assessmentSubmission.groupBy({
        by: ["studentId"],
        where: { assessmentId },
        _max: { totalScore: true },
        having: { totalScore: { _max: { gt: myScore } } },
      });
      currentUserRank = better.length + 1;
      currentUserEntry = {
        rank: currentUserRank,
        studentId: mine.student.id,
        firstName: mine.student.firstName,
        lastName: mine.student.lastName,
        avatarUrl: mine.student.profile?.avatarUrl ?? null,
        score: myScore,
        totalPoints: assessment.totalPoints,
        submittedAt: mine.submittedAt.toISOString(),
        isCurrentUser: true,
      };
    }
  }

  return NextResponse.json({ leaderboard, currentUserRank, currentUserEntry, totalPoints: assessment.totalPoints });
}
