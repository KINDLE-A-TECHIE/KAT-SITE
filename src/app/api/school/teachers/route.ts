import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/school/teachers, teachers assignable to this school's classes.
 *
 * TENANT ISOLATION: schoolId comes from the session (requireActiveSchool), and the
 * membership query is scoped by it, so this can only ever list teachers of the
 * caller's own school.
 */
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
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
