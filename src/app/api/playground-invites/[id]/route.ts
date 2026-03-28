import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["JOINED", "DISMISSED"]),
});

// PATCH /api/playground-invites/[id]
// Invitee marks their invite as JOINED or DISMISSED.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id } = await params;

  const body = await request.json() as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const invite = await prisma.playgroundInvite.findUnique({
    where: { id },
    select: { inviteeId: true, status: true },
  });
  if (!invite) return fail("Invite not found.", 404);
  if (invite.inviteeId !== session.user.id) return fail("Forbidden", 403);
  if (invite.status !== "PENDING") return fail("Invite is no longer pending.", 409);

  const updated = await prisma.playgroundInvite.update({
    where: { id },
    data:  { status: parsed.data.status },
    select: { id: true, status: true },
  });

  return ok({ invite: updated });
}
