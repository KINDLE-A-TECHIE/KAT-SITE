import bcrypt from "bcryptjs";
import crypto from "crypto";
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
  buildPasswordResetEmail,
} from "@/lib/email";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

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

  // For admin views, merge guest fields into a normalised applicant shape.
  const normalised = applications.map((app) => ({
    ...app,
    applicant: app.applicant ?? (app.guestEmail ? {
      id: null,
      firstName: app.guestFirstName ?? "",
      lastName: app.guestLastName ?? "",
      email: app.guestEmail,
    } : null),
  }));

  return ok({ applications: normalised });
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

    // External applicants (no prior enrolment) pay an application fee; students apply free.
    const enrollmentCount = await prisma.enrollment.count({ where: { userId: session.user.id } });
    const isExternalApplicant = enrollmentCount === 0;

    const application = await prisma.fellowApplication.create({
      data: {
        applicantId: session.user.id,
        cohortId: parsed.data.cohortId,
        motivation: parsed.data.motivation,
        experience: parsed.data.experience,
        isExternalApplicant,
      },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "fellow",
      eventName: "application_submitted",
      payload: { applicationId: application.id, cohortId: parsed.data.cohortId, isExternalApplicant },
    });

    return ok({ application, requiresPayment: isExternalApplicant }, 201);
  } catch (error) {
    return fail("Could not submit application.", 500, error instanceof Error ? error.message : error);
  }
}

// PATCH — admin approves or rejects an application.
// Guest (external) applications:
//   APPROVED → create user account, promote to FELLOW, send setup email, clear guest fields.
//   REJECTED → delete the application entirely (no personal data retained).
// Authenticated (student) applications:
//   APPROVED → promote existing user to FELLOW.
//   REJECTED → mark status REJECTED (user account already exists; they can re-apply).
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
        applicant: { select: { id: true, firstName: true, email: true, organizationId: true } },
        cohort: { select: { name: true, program: { select: { organizationId: true } } } },
      },
    });

    if (!application) return fail("Application not found.", 404);
    if (application.status !== ApplicationStatus.PENDING) {
      return fail("This application has already been reviewed.", 400);
    }

    const isGuest = !application.applicantId && !!application.guestEmail;

    // ── REJECTION ────────────────────────────────────────────────────────────
    if (parsed.data.status === "REJECTED") {
      if (isGuest) {
        // Delete entirely — no personal data retained for rejected guest applicants.
        await prisma.fellowApplication.delete({ where: { id: application.id } });

        sendEmail({
          to: application.guestEmail!,
          subject: "KAT Fellowship Application Update",
          ...buildFellowRejectionEmail({
            firstName: application.guestFirstName ?? "Applicant",
            reviewNotes: parsed.data.reviewNotes,
          }),
        }).catch((err: unknown) => console.error("[fellows/applications] Email send failed:", err));
      } else {
        // Authenticated student — mark rejected so they can re-apply later.
        await prisma.fellowApplication.update({
          where: { id: application.id },
          data: {
            status: ApplicationStatus.REJECTED,
            reviewedAt: new Date(),
            reviewedById: session.user.id,
            reviewNotes: parsed.data.reviewNotes,
          },
        });

        sendEmail({
          to: application.applicant!.email,
          subject: "KAT Fellowship Application Update",
          ...buildFellowRejectionEmail({
            firstName: application.applicant!.firstName,
            reviewNotes: parsed.data.reviewNotes,
          }),
        }).catch((err: unknown) => console.error("[fellows/applications] Email send failed:", err));
      }

      await trackEvent({
        userId: session.user.id,
        organizationId: session.user.organizationId,
        eventType: "fellow",
        eventName: "application_rejected",
        payload: { applicationId: application.id },
      });

      return ok({ status: "REJECTED" });
    }

    // ── APPROVAL ─────────────────────────────────────────────────────────────
    let fellowUserId: string;
    let fellowFirstName: string;
    let fellowEmail: string;

    if (isGuest) {
      // Create the user account now that the application is approved.
      const orgId =
        application.cohort?.program?.organizationId ?? session.user.organizationId ?? undefined;

      const randomPassword = crypto.randomBytes(24).toString("base64");
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      const newUser = await prisma.user.create({
        data: {
          email: application.guestEmail!,
          firstName: application.guestFirstName!,
          lastName: application.guestLastName!,
          passwordHash,
          role: UserRole.FELLOW,
          organizationId: orgId,
          profile: {
            create: { phone: application.guestPhone ?? null },
          },
        },
        select: { id: true },
      });

      fellowUserId = newUser.id;
      fellowFirstName = application.guestFirstName!;
      fellowEmail = application.guestEmail!;

      // Link application to the new user and clear guest fields.
      await prisma.fellowApplication.update({
        where: { id: application.id },
        data: {
          applicantId: newUser.id,
          status: ApplicationStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: session.user.id,
          reviewNotes: parsed.data.reviewNotes,
          guestFirstName: null,
          guestLastName: null,
          guestEmail: null,
          guestPhone: null,
        },
      });

      // Send account setup link (reuse password-reset flow, 72 h TTL).
      const setupToken = await prisma.passwordResetToken.create({
        data: { userId: newUser.id, expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS) },
      });
      const setupUrl = `${BASE_URL}/reset-password?token=${setupToken.token}`;

      sendEmail({
        to: fellowEmail,
        subject: "🎉 Your KAT Fellowship Application Was Approved!",
        html: buildPasswordResetEmail({ firstName: fellowFirstName, resetUrl: setupUrl }).replace(
          "Reset your password",
          "Your fellowship application was approved! Set up your account to get started.",
        ),
      }).catch((err: unknown) => console.error("[fellows/applications] Email send failed:", err));
    } else {
      // Authenticated student — promote existing user.
      fellowUserId = application.applicant!.id;
      fellowFirstName = application.applicant!.firstName;
      fellowEmail = application.applicant!.email;

      await prisma.$transaction([
        prisma.fellowApplication.update({
          where: { id: application.id },
          data: {
            status: ApplicationStatus.APPROVED,
            reviewedAt: new Date(),
            reviewedById: session.user.id,
            reviewNotes: parsed.data.reviewNotes,
          },
        }),
        prisma.user.update({
          where: { id: fellowUserId },
          data: { role: UserRole.FELLOW },
        }),
      ]);

      sendEmail({
        to: fellowEmail,
        subject: "🎉 Your KAT Fellowship Application Was Approved!",
        ...buildFellowApprovalEmail({
          firstName: fellowFirstName,
          cohortName: application.cohort?.name,
          reviewNotes: parsed.data.reviewNotes,
        }),
      }).catch((err: unknown) => console.error("[fellows/applications] Email send failed:", err));
    }

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "fellow",
      eventName: "application_approved",
      payload: { applicationId: application.id, applicantId: fellowUserId },
    });

    return ok({ status: "APPROVED" });
  } catch (error) {
    return fail("Could not review application.", 500, error instanceof Error ? error.message : error);
  }
}
