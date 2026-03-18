import { z } from "zod";
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
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { studentId: true } });
  if (!project) return fail("Project not found.", 404);
  if (project.studentId !== session.user.id) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const file = await prisma.projectFile.create({
    data: { projectId, ...parsed.data },
  });

  return ok({ file }, 201);
}
