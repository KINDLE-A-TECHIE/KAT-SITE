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

  // Best attempt per student (highest score, earliest if tied)
  const allSubmissions = await prisma.assessmentSubmission.findMany({
    where: { assessmentId },
    orderBy: [{ totalScore: "desc" }, { submittedAt: "asc" }],
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

  // Deduplicate: keep best attempt per student
  const seen = new Set<string>();
  const unique = allSubmissions.filter((s) => {
    if (seen.has(s.studentId)) return false;
    seen.add(s.studentId);
    return true;
  });

  const leaderboard = unique.map((s, i) => ({
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

  const currentUserRank = leaderboard.find((e) => e.isCurrentUser)?.rank ?? null;

  return NextResponse.json({ leaderboard, currentUserRank, totalPoints: assessment.totalPoints });
}
