import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

interface Params { params: Promise<{ projectId: string }> }

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(10).max(2000).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  deployedUrl: z.string().url().optional().or(z.literal("")),
  howToUse: z.string().max(2000).optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(), // students can only submit/retract
});

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, role: true, profile: { select: { avatarUrl: true } } } },
      program: { select: { id: true, name: true } },
      files: { orderBy: { uploadedAt: "asc" } },
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
    },
  });

  if (!project) return fail("Project not found.", 404);

  const { id: userId, role, organizationId } = session.user;
  const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  const isInstructor = role === UserRole.INSTRUCTOR;
  const isOwner = project.studentId === userId;

  if (!isOwner && !isAdmin && !isInstructor) {
    // Parents can view their children's projects
    if (role === UserRole.PARENT) {
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: userId, childId: project.studentId },
      });
      if (!link) return fail("Forbidden", 403);
    } else {
      return fail("Forbidden", 403);
    }
  }

  // Org boundary check for admins/instructors
  if ((isAdmin || isInstructor) && project.student.profile === undefined) {
    const student = await prisma.user.findUnique({
      where: { id: project.studentId },
      select: { organizationId: true },
    });
    if (student?.organizationId !== organizationId) return fail("Forbidden", 403);
  }

  return ok({ project });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return fail("Project not found.", 404);

  const isOwner = project.studentId === session.user.id;
  if (!isOwner) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { status: newStatus, ...fields } = parsed.data;
  const hasFieldEdits = Object.keys(fields).length > 0;
  const isRetract = newStatus === "DRAFT" && project.status === "SUBMITTED";
  const isSubmit = newStatus === "SUBMITTED" && (project.status === "DRAFT" || project.status === "NEEDS_WORK");

  // Field edits only allowed on DRAFT or NEEDS_WORK
  if (hasFieldEdits && project.status !== "DRAFT" && project.status !== "NEEDS_WORK") {
    return fail("Cannot edit a submitted or reviewed project.", 400);
  }
  // Status transitions: only submit or retract
  if (newStatus && !isRetract && !isSubmit) {
    return fail("Invalid status transition.", 400);
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
      ...(parsed.data.deployedUrl !== undefined && { deployedUrl: parsed.data.deployedUrl || null }),
      ...(parsed.data.howToUse !== undefined && { howToUse: parsed.data.howToUse || null }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
    },
    include: {
      program: { select: { id: true, name: true } },
      files: true,
      feedback: { include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } } },
      assets: {
        select: { id: true, name: true, mimeType: true, size: true, url: true, description: true, uploadedAt: true,
          uploader: { select: { firstName: true, lastName: true } } },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });

  return ok({ project: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { files: true },
  });
  if (!project) return fail("Project not found.", 404);

  const isAdmin = session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  if (project.studentId !== session.user.id && !isAdmin) return fail("Forbidden", 403);

  // Delete all R2 files
  await Promise.allSettled(project.files.map((f) => deleteR2Object(f.storageKey)));
  if (project.coverImageKey) await deleteR2Object(project.coverImageKey).catch(() => {});

  await prisma.project.delete({ where: { id: projectId } });
  return ok({ message: "Project deleted." });
}
