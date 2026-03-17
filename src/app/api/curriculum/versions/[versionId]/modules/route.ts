import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createModuleSchema } from "@/lib/validators";

interface Params { params: Promise<{ versionId: string }> }

const CREATOR_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { versionId } = await params;

  const modules = await prisma.module.findMany({
    where: { versionId },
    orderBy: { sortOrder: "asc" },
    include: {
      lessons: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, sortOrder: true, _count: { select: { contents: true } } },
      },
    },
  });

  return ok({ modules });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!CREATOR_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { versionId } = await params;

  const version = await prisma.curriculumVersion.findUnique({
    where: { id: versionId },
    select: { id: true },
  });
  if (!version) return fail("Version not found.", 404);

  const body = await request.json();
  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  let sortOrder = parsed.data.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.module.findFirst({
      where: { versionId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const mod = await prisma.module.create({
    data: { versionId, title: parsed.data.title, description: parsed.data.description, sortOrder },
  });

  return ok({ module: mod }, 201);
}