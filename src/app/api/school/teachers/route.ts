import { SchoolRole, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { getServerAuthSession } from "@/lib/auth";
import { teacherInviteSchema } from "@/lib/validators";
import { sendEmail, buildTeacherInviteEmail } from "@/lib/email";
import { SCHOOL_HOST } from "@/lib/school-host";
import { captureError } from "@/lib/sentry";

/**
 * School teachers, list + invite + revoke. SCHOOL_ADMIN only.
 *
 * TENANT ISOLATION: schoolId comes from the session (requireActiveSchool) and EVERY
 * query is scoped by it, so an admin can only ever see or change teachers of their own
 * school. Teachers are SCHOOL_STAFF on the global User.role (which grants NOTHING on
 * B2C); their authority is the TEACHER SchoolMembership created here.
 */

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

// GET /api/school/teachers, teachers of this school.
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  try {
    const memberships = await prisma.schoolMembership.findMany({
      where: { schoolId, role: SchoolRole.TEACHER },
      orderBy: { createdAt: "asc" },
      select: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return ok({ teachers: memberships.map((m) => m.user) });
  } catch (error) {
    captureError(error);
    return fail("Could not load teachers.", 500);
  }
}

// POST /api/school/teachers, invite a teacher by email.
export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }
  const session = await getServerAuthSession();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const parsed = teacherInviteSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }
  const { email, firstName, lastName } = parsed.data;

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    if (!school) return fail("School not found.", 404);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true, firstName: true },
      });

      let userId: string;
      let userFirst: string;
      let setupUrl: string | null = null;

      if (existing) {
        userId = existing.id;
        userFirst = existing.firstName;
      } else {
        // Same pattern as school-admin provisioning: an unusable random password, then a
        // password-reset token doubles as the account setup link.
        const randomPassword = crypto.randomBytes(24).toString("base64");
        const passwordHash = await bcrypt.hash(randomPassword, 12);
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            // SCHOOL_STAFF grants NOTHING on B2C. Authority is the TEACHER membership below.
            role: UserRole.SCHOOL_STAFF,
            organizationId: session!.user.organizationId,
            isActive: true,
          },
          select: { id: true, firstName: true },
        });
        userId = created.id;
        userFirst = created.firstName;
        const token = await tx.passwordResetToken.create({
          data: { userId, expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS) },
          select: { token: true },
        });
        setupUrl = `${BASE_URL}/reset-password?token=${token.token}`;
      }

      // Idempotent: unique(schoolId, userId). Never demote an existing SCHOOL_ADMIN via
      // the teacher form; re-inviting an existing teacher is a no-op (just resends).
      const membership = await tx.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId } },
        select: { role: true },
      });
      if (membership?.role === SchoolRole.SCHOOL_ADMIN) {
        throw new Error("ALREADY_ADMIN");
      }
      if (!membership) {
        await tx.schoolMembership.create({
          data: { schoolId, userId, role: SchoolRole.TEACHER },
        });
      }

      return { userId, userFirst, setupUrl, schoolName: school.name };
    });

    const proto = BASE_URL.startsWith("https") ? "https" : "http";
    const { html, text } = buildTeacherInviteEmail({
      firstName: result.userFirst,
      schoolName: result.schoolName,
      schoolUrl: `${proto}://${SCHOOL_HOST}/teach`,
      setupUrl: result.setupUrl,
    });
    await sendEmail({
      to: email,
      subject: `You have been added as a teacher at ${result.schoolName}`,
      html,
      text,
    });

    return ok({ teacher: { id: result.userId, firstName, lastName, email } }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_ADMIN") {
      return fail("That person is already an administrator of this school.", 409);
    }
    captureError(error);
    return fail("Could not invite the teacher.", 500);
  }
}

// DELETE /api/school/teachers?teacherId=..., revoke a teacher's access to this school.
export async function DELETE(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  const teacherId = new URL(request.url).searchParams.get("teacherId");
  if (!teacherId) return fail("teacherId is required.", 422);

  try {
    // Must be a TEACHER of THIS school. Scoped by schoolId, so no cross-tenant removal.
    const membership = await prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId: teacherId } },
      select: { role: true },
    });
    if (!membership || membership.role !== SchoolRole.TEACHER) {
      return fail("That teacher is not a member of this school.", 404);
    }

    // Remove access and clean up assignments in one transaction. The User row (and any
    // B2C identity the person may also hold) is left intact; only this school's TEACHER
    // grant is removed. Class-teacher audit rows are closed (unassignedAt), not deleted.
    await prisma.$transaction([
      prisma.schoolMembership.delete({
        where: { schoolId_userId: { schoolId, userId: teacherId } },
      }),
      prisma.schoolClass.updateMany({
        where: { schoolId, teacherId },
        data: { teacherId: null },
      }),
      prisma.schoolClassTeacher.updateMany({
        where: { schoolId, teacherId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      }),
    ]);

    return ok({ removed: true });
  } catch (error) {
    captureError(error);
    return fail("Could not remove the teacher.", 500);
  }
}
