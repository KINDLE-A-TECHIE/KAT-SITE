import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const submitSchema = z.object({
  quote: z.string().trim().min(20, "Please write at least 20 characters.").max(600),
  rating: z.number().int().min(1).max(5),
  childName: z.string().trim().max(50).optional(),
});

// GET /api/testimonials
// - Public (no auth): returns approved + featured testimonials for the landing page
// - PARENT: returns their own testimonials (all statuses)
// - SUPER_ADMIN: returns all testimonials (pending first)
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope"); // "mine" | "admin"

  // Super-admin review queue
  if (scope === "admin") {
    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      return fail("Forbidden", 403);
    }
    const testimonials = await prisma.testimonial.findMany({
      include: {
        author: { select: { id: true, firstName: true, lastName: true, profile: { select: { avatarUrl: true } } } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
    });
    return ok({ testimonials });
  }

  // Parent: own testimonials
  if (scope === "mine") {
    if (!session?.user?.id) return fail("Unauthorized", 401);
    if (session.user.role !== UserRole.PARENT) return fail("Forbidden", 403);
    const testimonials = await prisma.testimonial.findMany({
      where: { authorId: session.user.id },
      orderBy: { submittedAt: "desc" },
    });
    return ok({ testimonials });
  }

  // Public: approved + featured only
  const testimonials = await prisma.testimonial.findMany({
    where: { status: "APPROVED", featuredOnPage: true },
    include: {
      author: { select: { firstName: true, lastName: true, profile: { select: { avatarUrl: true } } } },
    },
    orderBy: { submittedAt: "desc" },
    take: 12,
  });
  return ok({ testimonials });
}

// POST /api/testimonials — parent submits a testimonial
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.PARENT) {
    return fail("Only parents can submit testimonials.", 403);
  }

  // Verify parent has at least one enrolled ward
  const hasEnrolledWard = await prisma.parentStudent.findFirst({
    where: {
      parentId: session.user.id,
      child: {
        enrollments: { some: { status: { in: ["ACTIVE", "COMPLETED"] } } },
      },
    },
    select: { childId: true },
  });
  if (!hasEnrolledWard) {
    return fail("You can only submit a testimonial once your child is enrolled in a program.", 403);
  }

  const body = await request.json() as unknown;
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid submission.", 400, parsed.error.flatten());

  // Each parent may have one pending/approved testimonial at a time
  const existing = await prisma.testimonial.findFirst({
    where: { authorId: session.user.id, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true, status: true },
  });
  if (existing) {
    return fail(
      existing.status === "APPROVED"
        ? "Your testimonial is already live on the site."
        : "You already have a testimonial awaiting review.",
      409,
    );
  }

  const testimonial = await prisma.testimonial.create({
    data: {
      authorId: session.user.id,
      quote: parsed.data.quote,
      rating: parsed.data.rating,
      childName: parsed.data.childName ?? null,
    },
  });

  // Notify super-admins
  const superAdmins = await prisma.user.findMany({
    where: { role: UserRole.SUPER_ADMIN },
    select: { id: true },
  });
  if (superAdmins.length > 0) {
    await prisma.notification.createMany({
      data: superAdmins.map((sa) => ({
        recipientId: sa.id,
        creatorId: session.user.id,
        type: "INFO" as const,
        title: "New testimonial awaiting review",
        body: JSON.stringify({
          text: `A parent has submitted a testimonial. Review it in the dashboard.`,
          targetPath: "/dashboard/testimonials",
        }),
      })),
      skipDuplicates: true,
    });
  }

  return ok({ testimonial }, 201);
}
