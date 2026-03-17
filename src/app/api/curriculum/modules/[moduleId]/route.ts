import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateModuleSchema } from "@/lib/validators";

interface Params { params: Promise<{ moduleId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  const canEdit = ([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR] as UserRole[]).includes(role);
  if (!canEdit) return fail("Forbidden", 403);

  const { moduleId } = await params;

  const body = await request.json();
  const parsed = updateModuleSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const mod = await prisma.module.update({
    where: { id: moduleId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  return ok({ module: mod });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(role)) return fail("Forbidden", 403);

  const { moduleId } = await params;
  await prisma.module.delete({ where: { id: moduleId } });

  return ok({ deleted: true });
}