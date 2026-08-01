import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PartnerInquiryStatus, PartnerType, SchoolRole, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateResetToken, hashResetToken } from "@/lib/reset-token";
import { schoolProvisionSchema } from "@/lib/validators";
import { sendEmail, buildSchoolAdminWelcomeEmail } from "@/lib/email";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/sentry";
import { SCHOOL_HOST } from "@/lib/school-host";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

function ensureSuperAdmin(role: UserRole) {
  if (role !== UserRole.SUPER_ADMIN) {
    throw new Error("Forbidden");
  }
}

/** Where the new school admin signs in, the school surface, not the B2C apex. */
function schoolDashboardUrl(): string {
  const proto = BASE_URL.startsWith("https") ? "https" : "http";
  return `${proto}://${SCHOOL_HOST}/admin`;
}

/**
 * POST /api/super-admin/schools/provision
 *
 * Turns an approved SCHOOL partner inquiry into a real tenant: creates the School,
 * attaches its first SCHOOL_ADMIN (an existing user, or a freshly created account
 * that gets a 72h setup link), and marks the inquiry APPROVED + linked.
 *
 * Idempotent by construction: an inquiry that already carries a schoolId is
 * refused, and SchoolMembership is unique on (schoolId, userId).
 */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  try {
    ensureSuperAdmin(session.user.role);
  } catch {
    return fail("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolProvisionSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid provisioning payload.", 400, parsed.error.flatten());
  }
  const { inquiryId, schoolName, slug, pricePerSeat, adminMode, adminEmail, adminFirstName, adminLastName } =
    parsed.data;

  // The negotiated seat price. Only a SUPER_ADMIN can set it, a school must never be
  // able to price itself, or it would invoice itself for a token amount and self-issue
  // a licence. Falls back to the configured default.
  const seatPrice = pricePerSeat ?? Number(process.env.SCHOOL_DEFAULT_PRICE_PER_SEAT ?? 0);

  try {
    const inquiry = await prisma.partnerInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, type: true, schoolId: true },
    });
    if (!inquiry) return fail("Inquiry not found.", 404);
    if (inquiry.type !== PartnerType.SCHOOL) {
      return fail("Only SCHOOL inquiries can be provisioned.", 422);
    }
    if (inquiry.schoolId) {
      return fail("This inquiry has already been provisioned.", 409);
    }

    const slugTaken = await prisma.school.findUnique({ where: { slug }, select: { id: true } });
    if (slugTaken) return fail("That school slug is already taken.", 409);

    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true, firstName: true },
    });

    if (adminMode === "existing" && !existingUser) {
      return fail("No user with that email exists. Create the account instead.", 404);
    }
    if (adminMode === "create" && existingUser) {
      return fail("A user with that email already exists. Invite them instead.", 409);
    }

    // School + admin user + membership + inquiry link must all land together, or
    // none of them, a half-provisioned school is worse than none.
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { name: schoolName, slug, pricePerSeat: seatPrice },
        select: { id: true, name: true },
      });

      let adminUserId: string;
      let adminFirst: string;

      if (existingUser) {
        adminUserId = existingUser.id;
        adminFirst = existingUser.firstName;
      } else {
        // Same pattern as fellow approval: unusable random password, then a
        // password-reset token doubles as the account setup link.
        const randomPassword = crypto.randomBytes(24).toString("base64");
        const passwordHash = await bcrypt.hash(randomPassword, 12);
        const created = await tx.user.create({
          data: {
            email: adminEmail,
            passwordHash,
            firstName: adminFirstName!,
            lastName: adminLastName!,
            // SCHOOL_STAFF grants NOTHING on B2C. This was INSTRUCTOR, a real B2C capability that
            // could message any student in the organization and read their submissions, children
            // this person has no standing over. Her authority is the SchoolMembership below, and
            // ensureSchoolMembership never reads this field.
            role: UserRole.SCHOOL_STAFF,
            organizationId: session.user.organizationId,
            isActive: true,
          },
          select: { id: true, firstName: true },
        });
        adminUserId = created.id;
        adminFirst = created.firstName;
      }

      await tx.schoolMembership.create({
        data: { schoolId: school.id, userId: adminUserId, role: SchoolRole.SCHOOL_ADMIN },
      });

      await tx.partnerInquiry.update({
        where: { id: inquiryId },
        data: { status: PartnerInquiryStatus.APPROVED, schoolId: school.id },
      });

      let setupUrl: string | null = null;
      if (!existingUser) {
        const rawSetupToken = generateResetToken();
        await tx.passwordResetToken.create({
          data: { userId: adminUserId, token: hashResetToken(rawSetupToken), expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS) },
        });
        setupUrl = `${BASE_URL}/reset-password?token=${rawSetupToken}`;
      }

      return { school, adminUserId, adminFirst, setupUrl };
    });

    const { html, text } = buildSchoolAdminWelcomeEmail({
      firstName: result.adminFirst,
      schoolName: result.school.name,
      schoolUrl: schoolDashboardUrl(),
      setupUrl: result.setupUrl,
    });
    await sendEmail({
      to: adminEmail,
      subject: `${result.school.name} is set up on KAT for Schools`,
      html,
      text,
    });

    await trackEvent({
      userId: session.user.id,
      eventType: "admin",
      eventName: "school_provisioned",
      payload: {
        schoolId: result.school.id,
        inquiryId,
        adminUserId: result.adminUserId,
        createdAccount: !existingUser,
      },
    });

    return ok(
      {
        school: result.school,
        adminCreated: !existingUser,
      },
      201,
    );
  } catch (error) {
    captureError(error);
    return fail("Could not provision the school.", 500);
  }
}
