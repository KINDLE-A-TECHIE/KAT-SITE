import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

interface Params { params: Promise<{ projectId: string; assetId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId, assetId } = await params;

  const asset = await prisma.projectAsset.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true, uploaderId: true, storageKey: true },
  });
  if (!asset || asset.projectId !== projectId) return fail("Asset not found.", 404);

  const role = session.user.role;
  const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  const isOwner = asset.uploaderId === session.user.id;
  if (!isOwner && !isAdmin) return fail("Forbidden", 403);

  await deleteR2Object(asset.storageKey).catch(() => {});
  await prisma.projectAsset.delete({ where: { id: assetId } });

  return ok({ message: "Asset deleted." });
}
