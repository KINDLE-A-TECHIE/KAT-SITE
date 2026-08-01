import { UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orgScope } from "@/lib/tenant";
import { programLifecycle } from "@/lib/program";

interface Params { params: Promise<{ programId: string }> }

const bodySchema = z.object({ publish: z.boolean() });

/**
 * POST /api/programs/[programId]/publish, move a programme between Draft and Published.
 *
 * SUPER_ADMIN only (matches Archive/Restore). Org-scoped: a foreign programme is a 404. Publishing
 * REQUIRES an active, published curriculum version, you cannot expose an empty programme to learners,
 * which is the whole point of the Draft phase. Unpublishing back to Draft is always allowed. An
 * archived programme must be restored first (archive is terminal until restored).
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { programId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("Expected { publish: boolean }.", 400);

  const program = await prisma.program.findFirst({
    where: { id: programId, ...orgScope(session.user.organizationId) },
    select: {
      id: true,
      isActive: true,
      isPublished: true,
      curriculum: {
        select: {
          versions: {
            where: { isActive: true, publishedAt: { not: null } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!program) return fail("Program not found.", 404);

  if (parsed.data.publish) {
    if (!program.isActive) {
      return fail("Restore this programme from the archive before publishing it.", 422);
    }
    const hasLiveVersion = (program.curriculum?.versions.length ?? 0) > 0;
    if (!hasLiveVersion) {
      return fail("Publish an active curriculum version before publishing the programme.", 422);
    }
  }

  const updated = await prisma.program.update({
    where: { id: programId },
    data: { isPublished: parsed.data.publish },
    select: { id: true, isActive: true, isPublished: true },
  });

  return ok({ program: updated, status: programLifecycle(updated) });
}
