import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  programId: z.string().cuid().optional(),
  deployedUrl: z.string().url().optional().or(z.literal("")),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
});

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id: userId, role, organizationId } = session.user;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const statusFilter = url.searchParams.get("status");
  const programId = url.searchParams.get("programId");

  const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  const isInstructor = role === UserRole.INSTRUCTOR;

  let where: Record<string, unknown> = {};

  if (isAdmin) {
    // Admins see all projects in their org
    where = {
      student: { organizationId },
      ...(studentId ? { studentId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(programId ? { programId } : {}),
    };
  } else if (isInstructor) {
    // Instructors see submitted/approved/needs_work/rejected projects in their org
    const allowedStatuses = ["SUBMITTED", "APPROVED", "NEEDS_WORK", "REJECTED"];
    where = {
      student: { organizationId },
      status: statusFilter && allowedStatuses.includes(statusFilter)
        ? statusFilter
        : { in: allowedStatuses },
      ...(studentId ? { studentId } : {}),
      ...(programId ? { programId } : {}),
    };
  } else if (role === UserRole.PARENT) {
    // Parents see their children's projects
    const childLinks = await prisma.parentStudent.findMany({
      where: { parentId: userId },
      select: { childId: true },
    });
    const childIds = childLinks.map((l) => l.childId);
    where = { studentId: { in: childIds } };
  } else {
    // STUDENT / FELLOW — own projects only
    where = { studentId: userId };
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      program: { select: { id: true, name: true } },
      files: { select: { id: true, name: true, mimeType: true, size: true, url: true } },
      feedback: {
        include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { files: true, feedback: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return ok({ projects });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role;
  if (role !== UserRole.STUDENT && role !== UserRole.FELLOW) {
    return fail("Only students and fellows can create projects.", 403);
  }

  const body = await request.json() as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { title, description, tags, programId, deployedUrl, visibility } = parsed.data;

  // Verify enrollment if programId provided
  if (programId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: session.user.id, programId, status: { in: ["ACTIVE", "COMPLETED"] } },
    });
    if (!enrollment) return fail("You are not enrolled in that program.", 403);
  }

  const project = await prisma.project.create({
    data: {
      studentId: session.user.id,
      programId: programId ?? null,
      title,
      description,
      tags,
      deployedUrl: deployedUrl || null,
      visibility,
    },
    include: {
      program: { select: { id: true, name: true } },
      files: true,
      feedback: true,
    },
  });

  return ok({ project }, 201);
}
