import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ projectId: string }> }

const schema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  storageKey: z.string().min(1),
  url: z.string().url(),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role;
  const canUploadAsset =
    role === UserRole.INSTRUCTOR || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  if (!canUploadAsset) return fail("Forbidden", 403);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return fail("Project not found.", 404);

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const asset = await prisma.projectAsset.create({
    data: {
      projectId,
      uploaderId: session.user.id,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      size: parsed.data.size,
      storageKey: parsed.data.storageKey,
      url: parsed.data.url,
      description: parsed.data.description ?? null,
    },
    include: { uploader: { select: { firstName: true, lastName: true } } },
  });

  return ok({ asset }, 201);
}
