import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePresignedUploadUrl, r2PublicUrl } from "@/lib/r2";
import { randomUUID } from "crypto";

interface Params { params: Promise<{ assessmentId: string }> }

const MAX_RESOURCE_SIZE = 50 * 1024 * 1024; // 50 MB

const schema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive().max(MAX_RESOURCE_SIZE, { message: "File too large (max 50 MB)." }),
});

const UPLOADER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!UPLOADER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { assessmentId } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, programId: true, program: { select: { organizationId: true } } },
  });
  if (!assessment) return fail("Assessment not found.", 404);

  // Non-super-admins can only upload to assessments in their org
  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    assessment.program.organizationId !== session.user.organizationId
  ) {
    return fail("Forbidden", 403);
  }

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { name, mimeType, size } = parsed.data;
  const ext = name.split(".").pop() ?? "bin";
  const key = `assessments/${assessmentId}/resources/${randomUUID()}.${ext}`;

  const uploadUrl = await generatePresignedUploadUrl(key, mimeType);
  const publicUrl = r2PublicUrl(key);

  return ok({ uploadUrl, key, publicUrl, name, mimeType, size });
}
