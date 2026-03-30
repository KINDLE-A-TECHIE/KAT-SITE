import { NextResponse } from "next/server";
import { UserRole, AssessmentType } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, role, organizationId } = session.user;

  // Students / Fellows — see PROJECT assessments for their enrolled programs
  if (role === UserRole.STUDENT || role === UserRole.FELLOW) {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: "ACTIVE" },
      select: { programId: true },
    });
    const programIds = enrollments.map((e) => e.programId);

    const assessments = await prisma.assessment.findMany({
      where: {
        programId: { in: programIds },
        type: AssessmentType.PROJECT,
        published: true,
        verificationStatus: "APPROVED",
      },
      include: {
        program: { select: { id: true, name: true } },
        module: { select: { id: true, title: true } },
        resources: {
          select: { id: true, name: true, url: true, mimeType: true, size: true, description: true },
          orderBy: { uploadedAt: "asc" },
        },
        projects: {
          where: { studentId: userId },
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            files: { select: { id: true } },
            assets: { select: { id: true } },
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    const assignments = assessments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      weekNumber: a.weekNumber,
      totalPoints: a.totalPoints,
      passScore: a.passScore,
      dueDate: a.dueDate?.toISOString() ?? null,
      program: a.program,
      module: a.module,
      resources: a.resources,
      linkedProject: a.projects[0] ?? null,
    }));

    return NextResponse.json({ assignments });
  }

  // Instructors / Admins — see all PROJECT assessments in their org
  const assessments = await prisma.assessment.findMany({
    where: {
      ...(organizationId ? { program: { organizationId } } : {}),
      type: AssessmentType.PROJECT,
    },
    include: {
      program: { select: { id: true, name: true } },
      module: { select: { id: true, title: true } },
      resources: {
        select: { id: true, name: true, url: true, mimeType: true, size: true, description: true },
        orderBy: { uploadedAt: "asc" },
      },
      _count: { select: { projects: true, submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const assignments = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    weekNumber: a.weekNumber,
    totalPoints: a.totalPoints,
    passScore: a.passScore,
    dueDate: a.dueDate?.toISOString() ?? null,
    program: a.program,
    module: a.module,
    resources: a.resources,
    linkedProject: null,
    _count: a._count,
  }));

  return NextResponse.json({ assignments });
}
