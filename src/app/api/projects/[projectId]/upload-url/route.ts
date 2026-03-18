import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePresignedUploadUrl, r2PublicUrl } from "@/lib/r2";
import { randomUUID } from "crypto";

interface Params { params: Promise<{ projectId: string }> }

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "video/mp4", "video/webm",
  "application/pdf",
  "application/zip", "application/x-zip-compressed",
  "text/plain", "text/html", "text/css", "text/javascript",
  "application/json",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const schema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().refine((t) => ALLOWED_TYPES.includes(t), { message: "File type not allowed." }),
  size: z.number().int().positive().max(MAX_FILE_SIZE, { message: "File too large (max 50 MB)." }),
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { studentId: true, status: true, _count: { select: { files: true } } },
  });
  if (!project) return fail("Project not found.", 404);
  if (project.studentId !== session.user.id) return fail("Forbidden", 403);
  if (project.status !== "DRAFT" && project.status !== "NEEDS_WORK") {
    return fail("Cannot add files to a submitted project.", 400);
  }
  if (project._count.files >= 10) return fail("Maximum 10 files per project.", 400);

  // Only students and fellows can upload
  const role = session.user.role;
  if (role !== UserRole.STUDENT && role !== UserRole.FELLOW) {
    return fail("Forbidden", 403);
  }

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { name, mimeType, size } = parsed.data;
  const ext = name.split(".").pop() ?? "";
  const key = `projects/${projectId}/${randomUUID()}.${ext}`;

  const uploadUrl = await generatePresignedUploadUrl(key, mimeType);
  const publicUrl = r2PublicUrl(key);

  return ok({ uploadUrl, key, publicUrl, name, mimeType, size });
}
