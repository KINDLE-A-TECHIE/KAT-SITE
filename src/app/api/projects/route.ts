import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectCreateLimiter, rateLimitResponse } from "@/lib/ratelimit";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(10).max(2000),
  tags: z.array(z.string().max(30)).max(10).default([]),
  programId: z.string().cuid().optional(),
  deployedUrl: z.string().url().optional().or(z.literal("")),
  howToUse: z.string().max(2000).optional(),
});

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id: userId, role, organizationId } = session.user;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const statusFilter = url.searchParams.get("status");
  const programId = url.searchParams.get("programId");
  const search = url.searchParams.get("search")?.trim() ?? "";
  const cursor = url.searchParams.get("cursor");
  const paginate = url.searchParams.get("paginate") === "1";

  const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  const isInstructor = role === UserRole.INSTRUCTOR;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: Record<string, any> = {};

  const searchFilter = search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { tags: { has: search } },
          { student: { OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ]}},
        ],
      }
    : {};

  if (isAdmin) {
    where = {
      student: { organizationId },
      ...(studentId ? { studentId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(programId ? { programId } : {}),
      ...searchFilter,
    };
  } else if (isInstructor) {
    const allowedStatuses = ["SUBMITTED", "APPROVED", "NEEDS_WORK", "REJECTED"];
    where = {
      student: { organizationId },
      status: statusFilter && allowedStatuses.includes(statusFilter)
        ? statusFilter
        : { in: allowedStatuses },
      ...(studentId ? { studentId } : {}),
      ...(programId ? { programId } : {}),
      ...searchFilter,
    };
  } else if (role === UserRole.PARENT) {
    const childLinks = await prisma.parentStudent.findMany({
      where: { parentId: userId },
      select: { childId: true },
    });
    const childIds = childLinks.map((l) => l.childId);
    where = {
      studentId: { in: childIds },
      ...searchFilter,
    };
  } else {
    // STUDENT / FELLOW — own projects only
    where = { studentId: userId };
  }

  const take = paginate ? PAGE_SIZE + 1 : undefined;

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
      reviews: {
        include: { reviewer: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      assets: {
        select: { id: true, name: true, mimeType: true, size: true, url: true, description: true, uploadedAt: true,
          uploader: { select: { firstName: true, lastName: true } } },
        orderBy: { uploadedAt: "asc" },
      },
      _count: { select: { files: true, feedback: true } },
    },
    orderBy: { updatedAt: "desc" },
    ...(take ? { take } : {}),
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  if (!paginate) return ok({ projects });

  const hasMore = projects.length > PAGE_SIZE;
  const page = hasMore ? projects.slice(0, PAGE_SIZE) : projects;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return ok({ projects: page, hasMore, nextCursor });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role;
  if (role !== UserRole.STUDENT && role !== UserRole.FELLOW) {
    return fail("Only students and fellows can create projects.", 403);
  }

  if (projectCreateLimiter) {
    const { success, reset } = await projectCreateLimiter.limit(session.user.id);
    if (!success) return rateLimitResponse(reset);
  }

  const body = await request.json() as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { title, description, tags, programId, deployedUrl, howToUse } = parsed.data;

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
      howToUse: howToUse ?? null,
    },
    include: {
      program: { select: { id: true, name: true } },
      files: true,
      feedback: true,
    },
  });

  return ok({ project }, 201);
}
