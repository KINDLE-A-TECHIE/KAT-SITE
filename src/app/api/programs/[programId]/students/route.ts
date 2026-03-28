import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES: UserRole[] = [UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

// GET /api/programs/[programId]/students?search=name
// Returns active/completed enrolled students and fellows for the given program.
// Used by instructors/admins to populate the playground invite picker.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ALLOWED_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { programId } = await params;
  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";

  const enrollments = await prisma.enrollment.findMany({
    where: {
      programId,
      status: { in: ["ACTIVE", "COMPLETED"] },
      user: {
        role: { in: [UserRole.STUDENT, UserRole.FELLOW] },
        isActive: true,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName:  { contains: search, mode: "insensitive" } },
                { email:     { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    select: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    take: 50,
  });

  const students = enrollments.map((e) => e.user);
  return ok({ students });
}
