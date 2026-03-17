import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildExternalFellowApplicationEmail } from "@/lib/email";

const schema = z.object({
  firstName:   z.string().trim().min(2).max(100),
  lastName:    z.string().trim().min(2).max(100),
  email:       z.string().email().toLowerCase().trim(),
  phone:       z.string().trim().min(7).max(20).optional(),
  cohortId:    z.string().min(1),
  motivation:  z.string().trim().min(50).max(3000),
  experience:  z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid application data.", 400, parsed.error.flatten());
    }

    const { firstName, lastName, email, phone, cohortId, motivation, experience } = parsed.data;

    // Verify the cohort exists and is open
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true,
        name: true,
        applicationOpen: true,
        applicationClosesAt: true,
        externalApplicationFee: true,
        program: { select: { name: true } },
      },
    });

    if (!cohort) return fail("Cohort not found.", 404);
    if (!cohort.applicationOpen) return fail("Applications for this cohort are currently closed.", 400);
    if (cohort.applicationClosesAt && cohort.applicationClosesAt < new Date()) {
      return fail("The application deadline for this cohort has passed.", 400);
    }

    // Check for a duplicate guest submission on this cohort
    const existingGuest = await prisma.fellowApplication.findFirst({
      where: { guestEmail: email, cohortId },
      select: { id: true, status: true },
    });

    if (existingGuest?.status === "PENDING") {
      return fail("An application from this email is already pending for this cohort.", 409);
    }
    if (existingGuest?.status === "APPROVED") {
      return fail("An application from this email has already been approved.", 409);
    }

    // Also check if a registered user with this email already applied
    const registeredUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (registeredUser) {
      const existingAuth = await prisma.fellowApplication.findUnique({
        where: { applicantId_cohortId: { applicantId: registeredUser.id, cohortId } },
        select: { status: true },
      });
      if (existingAuth?.status === "PENDING") {
        return fail("This account already has a pending application for this cohort.", 409);
      }
      if (existingAuth?.status === "APPROVED") {
        return fail("This account's application has already been approved.", 409);
      }
    }

    // Store application with guest details only — no account created yet
    if (existingGuest) {
      // Re-application after rejection
      await prisma.fellowApplication.update({
        where: { id: existingGuest.id },
        data: {
          guestFirstName: firstName,
          guestLastName: lastName,
          guestPhone: phone ?? null,
          motivation,
          experience,
          status: "PENDING",
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          reviewNotes: null,
        },
      });
    } else {
      await prisma.fellowApplication.create({
        data: {
          cohortId,
          guestFirstName: firstName,
          guestLastName: lastName,
          guestEmail: email,
          guestPhone: phone ?? null,
          motivation,
          experience,
          isExternalApplicant: true,
          status: "PENDING",
        },
      });
    }

    const fee = cohort.externalApplicationFee ? Number(cohort.externalApplicationFee) : null;

    // Send confirmation email (fire-and-forget)
    sendEmail({
      to: email,
      subject: "KAT Fellowship Application Received",
      html: buildExternalFellowApplicationEmail({
        firstName,
        cohortName: cohort.name,
        programName: cohort.program?.name ?? cohort.name,
        requiresPayment: fee !== null,
        fee,
      }),
    }).catch((err: unknown) => {
      console.error("[fellows/apply/external] Email send failed:", err);
    });

    return ok(
      {
        requiresPayment: fee !== null,
        fee,
        message: "Application submitted! We'll review it and reach out via email.",
      },
      201,
    );
  } catch (error) {
    return fail("Could not submit application.", 500, error instanceof Error ? error.message : error);
  }
}
