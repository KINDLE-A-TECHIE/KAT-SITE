import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePresignedUploadUrl, r2PublicUrl } from "@/lib/r2";
import { randomUUID } from "crypto";
import { projectUploadLimiter, rateLimitResponse } from "@/lib/ratelimit";

interface Params { params: Promise<{ projectId: string }> }

const MAX_ASSET_SIZE = 20 * 1024 * 1024; // 20 MB

const schema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive().max(MAX_ASSET_SIZE, { message: "Asset file too large (max 20 MB)." }),
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role;
  const canUploadAsset =
    role === UserRole.INSTRUCTOR || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  if (!canUploadAsset) return fail("Only instructors and admins can upload project assets.", 403);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, student: { select: { organizationId: true } } },
  });
  if (!project) return fail("Project not found.", 404);

  if (projectUploadLimiter) {
    const { success, reset } = await projectUploadLimiter.limit(session.user.id);
    if (!success) return rateLimitResponse(reset);
  }

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { name, mimeType, size } = parsed.data;
  const ext = name.split(".").pop() ?? "bin";
  const key = `projects/${projectId}/assets/${randomUUID()}.${ext}`;

  const uploadUrl = await generatePresignedUploadUrl(key, mimeType);
  const publicUrl = r2PublicUrl(key);

  return ok({ uploadUrl, key, publicUrl, name, mimeType, size });
}
