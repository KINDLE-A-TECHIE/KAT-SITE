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
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: "ACTIVE" },
      select: { programId: true, id: true },
    });

    const programIds = enrollments.map((e) => e.programId);

    const challenges = await prisma.assessment.findMany({
      where: {
        programId: { in: programIds },
        type: CHALLENGE,
        published: true,
        verificationStatus: "APPROVED",
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

  return NextResponse.json({ challenges });
}
