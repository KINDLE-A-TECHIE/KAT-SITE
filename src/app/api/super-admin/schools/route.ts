import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { listManagedSchools } from "@/lib/super-admin-schools";
import { captureError } from "@/lib/sentry";

function ensureSuperAdmin(role: UserRole) {
  if (role !== UserRole.SUPER_ADMIN) {
    throw new Error("Forbidden");
  }
}

/**
 * GET /api/super-admin/schools
 *
 * Every school with its management stats (price, seat usage, revenue, counts). SUPER_ADMIN only,
 * this is the cross-tenant view a super-admin uses to price and monitor schools; a school admin
 * only ever sees their own tenant.
 */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  try {
    ensureSuperAdmin(session.user.role);
  } catch {
    return fail("Forbidden", 403);
  }

  try {
    const schools = await listManagedSchools();
    return ok({ schools });
  } catch (error) {
    captureError(error);
    return fail("Could not load schools.", 500);
  }
}
