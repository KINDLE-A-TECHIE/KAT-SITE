import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AssessmentType } from "@prisma/client";

const CHALLENGE = "CHALLENGE" as AssessmentType;

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, role, organizationId } = session.user;

  if (role === "STUDENT" || role === "FELLOW") {
    const [enrollments, gateStatuses] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId, status: "ACTIVE" },
        select: { programId: true, id: true },
      }),
      prisma.moduleGateStatus.findMany({
        where: { userId },
        select: { moduleId: true },
      }),
    ]);

    const programIds = enrollments.map((e) => e.programId);
    const unlockedModuleIds = gateStatuses.map((g) => g.moduleId);

    const challenges = await prisma.assessment.findMany({
      where: {
        programId: { in: programIds },
        type: CHALLENGE,
        published: true,
        // Only show global challenges (no module) or challenges for modules the student has reached
        OR: [
          { moduleId: null },
          { moduleId: { in: unlockedModuleIds } },
        ],
      },
      include: {
        program: { select: { id: true, name: true } },
        module: { select: { id: true, title: true } },
        questions: {
          select: { id: true, prompt: true, type: true, points: true },
          orderBy: { sortOrder: "asc" },
        },
        submissions: {
          where: { studentId: userId },
          select: { id: true, status: true, totalScore: true, submittedAt: true, attemptNumber: true },
          orderBy: { attemptNumber: "desc" },
          take: 1,
        },
        _count: { select: { submissions: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ challenges });
  }

  // Instructors / Admins / Super admins
  const challenges = await prisma.assessment.findMany({
    where: {
      ...(organizationId ? { program: { organizationId } } : {}),
      type: CHALLENGE,
    },
    include: {
      program: { select: { id: true, name: true } },
      module: { select: { id: true, title: true } },
      questions: {
        select: { id: true, prompt: true, type: true, points: true },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Add empty submissions array for type compatibility with learner response
  const result = challenges.map((c) => ({ ...c, submissions: [] as never[] }));
  return NextResponse.json({ challenges: result });
}
