import { z } from "zod";
import { ApplicationStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import {
  sendEmail,
  buildFellowApprovalEmail,
  buildFellowRejectionEmail,
} from "@/lib/email";

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const applySchema = z.object({
  cohortId: z.string().cuid().optional(),
  motivation: z.string().trim().min(50).max(3000),
  experience: z.string().trim().max(2000).optional(),
});

const reviewSchema = z.object({
  applicationId: z.string().cuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().trim().max(2000).optional(),
});

// GET — admin sees all applications; students see their own.
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") as ApplicationStatus | null;
  const cohortId = url.searchParams.get("cohortId");

  const isAdmin = ADMIN_ROLES.includes(session.user.role);

  const where = {
    ...(isAdmin
      ? {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(cohortId ? { cohortId } : {}),
        }
      : { applicantId: session.user.id }),
  };

  const applications = await prisma.fellowApplication.findMany({
    where,
    include: {
      applicant: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      cohort: { select: { id: true, name: true, startsAt: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  return ok({ applications });
}

// POST — student submits an application.
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  if (session.user.role !== UserRole.STUDENT) {
    return fail("Only students can apply to become fellows.", 403);
  }

  try {
    const body = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid application payload.", 400, parsed.error.flatten());
    }

    // One active application per student per cohort (or global if no cohort).
    const existing = await prisma.fellowApplication.findUnique({
      where: {
        applicantId_cohortId: {
          applicantId: session.user.id,
          cohortId: parsed.data.cohortId ?? null as unknown as string,
        },
      },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status === ApplicationStatus.PENDING) {
        return fail("You already have a pending application for this cohort.", 409);
      }
      if (existing.status === ApplicationStatus.APPROVED) {
        return fail("Your application was already approved.", 409);
      }
      // Rejected — allow re-application by updating.
      const updated = await prisma.fellowApplication.update({
        where: { id: existing.id },
        data: {
          motivation: parsed.data.motivation,
          experience: parsed.data.experience,
          status: ApplicationStatus.PENDING,
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          reviewNotes: null,
        },
      });
      return ok({ application: updated });
    }

    const application = await prisma.fellowApplication.create({
      data: {
        applicantId: session.user.id,
        cohortId: parsed.data.cohortId,
        motivation: parsed.data.motivation,
        experience: parsed.data.experience,
      },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "fellow",
      eventName: "application_submitted",
      payload: { applicationId: application.id, cohortId: parsed.data.cohortId },
    });

    return ok({ application }, 201);
  } catch (error) {
    return fail("Could not submit application.", 500, error instanceof Error ? error.message : error);
  }
}

// PATCH — admin approves or rejects an application.
// Approval automatically promotes the user's role to FELLOW.
export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  if (!ADMIN_ROLES.includes(session.user.role)) {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid review payload.", 400, parsed.error.flatten());
    }

    const application = await prisma.fellowApplication.findUnique({
      where: { id: parsed.data.applicationId },
      include: {
        applicant: {
          select: { id: true, firstName: true, email: true, organizationId: true },
        },
        cohort: { select: { name: true } },
      },
    });

    if (!application) return fail("Application not found.", 404);
    if (application.status !== ApplicationStatus.PENDING) {
      return fail("This application has already been reviewed.", 400);
    }

    const updatedApplication = await prisma.fellowApplication.update({
      where: { id: application.id },
      data: {
        status: parsed.data.status as ApplicationStatus,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
        reviewNotes: parsed.data.reviewNotes,
      },
    });

    // Promote to FELLOW on approval.
    if (parsed.data.status === "APPROVED") {
      await prisma.user.update({
        where: { id: application.applicantId },
        data: { role: UserRole.FELLOW },
      });
    }

    // Send notification email (fire-and-forget — don't fail the request if email fails).
    const { html, text } =
      parsed.data.status === "APPROVED"
        ? buildFellowApprovalEmail({
            firstName: application.applicant.firstName,
            cohortName: application.cohort?.name,
            reviewNotes: parsed.data.reviewNotes,
          })
        : buildFellowRejectionEmail({
            firstName: application.applicant.firstName,
            reviewNotes: parsed.data.reviewNotes,
          });

    sendEmail({
      to: application.applicant.email,
      subject:
        parsed.data.status === "APPROVED"
          ? "🎉 Your KAT Fellowship Application Was Approved!"
          : "KAT Fellowship Application Update",
      html,
      text,
    }).catch((err: unknown) => {
      console.error("[fellows/applications] Email send failed:", err);
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "fellow",
      eventName: parsed.data.status === "APPROVED" ? "application_approved" : "application_rejected",
      payload: {
        applicationId: application.id,
        applicantId: application.applicantId,
      },
    });

    return ok({ application: updatedApplication });
  } catch (error) {
    return fail("Could not review application.", 500, error instanceof Error ? error.message : error);
  }
}
