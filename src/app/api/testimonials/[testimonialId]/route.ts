import { z } from "zod";
import { NotificationType, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ testimonialId: string }> }

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "unfeature", "feature"]),
  rejectionNote: z.string().trim().max(500).optional(),
});

// PATCH — super-admin reviews a testimonial
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { testimonialId } = await params;
  const testimonial = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
    select: { id: true, authorId: true, quote: true, status: true },
  });
  if (!testimonial) return fail("Testimonial not found.", 404);

  const body = await request.json() as unknown;
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const { action, rejectionNote } = parsed.data;
  const now = new Date();

  let updateData: Record<string, unknown> = {};
  let notifyAuthor = false;
  let notifTitle = "";
  let notifText = "";
  let notifType: NotificationType = NotificationType.INFO;

  switch (action) {
    case "approve":
      updateData = { status: "APPROVED", featuredOnPage: true, reviewedById: session.user.id, reviewedAt: now, rejectionNote: null };
      notifyAuthor = true;
      notifTitle = "Your testimonial is live! 🎉";
      notifText = "Thank you — your testimonial has been approved and is now featured on the KAT website.";
      notifType = NotificationType.SUCCESS;
      break;
    case "reject":
      updateData = { status: "REJECTED", featuredOnPage: false, reviewedById: session.user.id, reviewedAt: now, rejectionNote: rejectionNote ?? null };
      notifyAuthor = true;
      notifTitle = "Testimonial update";
      notifText = rejectionNote
        ? `Your testimonial could not be published: ${rejectionNote}`
        : "Your testimonial was not approved for the website at this time.";
      notifType = NotificationType.INFO;
      break;
    case "unfeature":
      updateData = { featuredOnPage: false };
      break;
    case "feature":
      updateData = { featuredOnPage: true };
      break;
  }

  const updated = await prisma.testimonial.update({
    where: { id: testimonialId },
    data: updateData,
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (notifyAuthor) {
    await prisma.notification.create({
      data: {
        recipientId: testimonial.authorId,
        creatorId: session.user.id,
        type: notifType,
        title: notifTitle,
        body: JSON.stringify({ text: notifText, targetPath: "/dashboard/testimonials" }),
      },
    });
  }

  return ok({ testimonial: updated });
}

// DELETE — super-admin hard-deletes a testimonial
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { testimonialId } = await params;
  const testimonial = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
    select: { id: true },
  });
  if (!testimonial) return fail("Testimonial not found.", 404);

  await prisma.testimonial.delete({ where: { id: testimonialId } });
  return ok({ testimonialId });
}
