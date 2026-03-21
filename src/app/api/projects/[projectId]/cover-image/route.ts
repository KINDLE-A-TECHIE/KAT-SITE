import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object, generatePresignedUploadUrl, r2PublicUrl } from "@/lib/r2";
import { randomUUID } from "crypto";
import { projectUploadLimiter, rateLimitResponse } from "@/lib/ratelimit";

interface Params { params: Promise<{ projectId: string }> }

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const uploadSchema = z.object({
  mimeType: z.string().refine((t) => ALLOWED_IMAGE_TYPES.includes(t), { message: "Only JPEG, PNG or WebP images are allowed." }),
  size: z.number().int().positive().max(MAX_SIZE, { message: "Cover image must be under 5 MB." }),
});

const confirmSchema = z.object({
  key: z.string().min(1),
  url: z.string().url(),
});

/** POST /api/projects/[projectId]/cover-image/upload-url — get presigned URL */
export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role;
  if (role !== UserRole.STUDENT && role !== UserRole.FELLOW) return fail("Forbidden", 403);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { studentId: true, status: true, coverImageKey: true },
  });
  if (!project) return fail("Project not found.", 404);
  if (project.studentId !== session.user.id) return fail("Forbidden", 403);
  if (project.status !== "DRAFT" && project.status !== "NEEDS_WORK") {
    return fail("Cannot update cover image on a submitted project.", 400);
  }

  if (projectUploadLimiter) {
    const { success, reset } = await projectUploadLimiter.limit(session.user.id);
    if (!success) return rateLimitResponse(reset);
  }

  const body = await request.json() as unknown;
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const ext = parsed.data.mimeType === "image/png" ? "png" : parsed.data.mimeType === "image/webp" ? "webp" : "jpg";
  const key = `projects/${projectId}/cover/${randomUUID()}.${ext}`;
  const uploadUrl = await generatePresignedUploadUrl(key, parsed.data.mimeType);
  const publicUrl = r2PublicUrl(key);

  return ok({ uploadUrl, key, publicUrl });
}

/** PATCH /api/projects/[projectId]/cover-image — confirm upload and save to project */
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { studentId: true, status: true, coverImageKey: true },
  });
  if (!project) return fail("Project not found.", 404);
  if (project.studentId !== session.user.id) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  // Delete old cover image from R2 if one exists
  if (project.coverImageKey) {
    await deleteR2Object(project.coverImageKey).catch(() => {});
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { coverImageKey: parsed.data.key, coverImageUrl: parsed.data.url },
    select: { id: true, coverImageUrl: true },
  });

  return ok({ coverImageUrl: updated.coverImageUrl });
}

/** DELETE /api/projects/[projectId]/cover-image — remove cover image */
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { studentId: true, coverImageKey: true },
  });
  if (!project) return fail("Project not found.", 404);
  if (project.studentId !== session.user.id) return fail("Forbidden", 403);
  if (!project.coverImageKey) return ok({ message: "No cover image." });

  await deleteR2Object(project.coverImageKey).catch(() => {});
  await prisma.project.update({
    where: { id: projectId },
    data: { coverImageKey: null, coverImageUrl: null },
  });

  return ok({ message: "Cover image removed." });
}
