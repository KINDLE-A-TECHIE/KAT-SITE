import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — approve or reject a pending certificate (SUPER_ADMIN only)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== "SUPER_ADMIN") return fail("Forbidden", 403);

  const { id } = await params;
  const cert = await prisma.certificate.findUnique({ where: { id } });
  if (!cert) return fail("Certificate not found", 404);
  if (cert.status !== "PENDING") return fail("Only pending certificates can be reviewed");

  const body = await request.json() as { action?: "APPROVE" | "REJECT"; rejectionNote?: string };
  if (!body.action || !["APPROVE", "REJECT"].includes(body.action))
    return fail("action must be APPROVE or REJECT");

  const updated = await prisma.certificate.update({
    where: { id },
    data:
      body.action === "APPROVE"
        ? { status: "APPROVED", approvedById: session.user.id, approvedAt: new Date(), rejectionNote: null }
        : { status: "REJECTED", approvedById: session.user.id, approvedAt: new Date(), rejectionNote: body.rejectionNote?.trim() ?? null },
    include: {
      user:       { select: { id: true, firstName: true, lastName: true, email: true } },
      program:    { select: { id: true, name: true, level: true } },
      issuedBy:   { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return ok({ certificate: updated });
}

// DELETE — revoke a certificate (SUPER_ADMIN / ADMIN only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) return fail("Forbidden", 403);

  const { id } = await params;
  const cert = await prisma.certificate.findUnique({ where: { id } });
  if (!cert) return fail("Certificate not found", 404);

  await prisma.certificate.delete({ where: { id } });
  return ok({ message: "Certificate revoked." });
}
