import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerAuthSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { SCHOOL_ROLES, DASHBOARD_ROUTES } from "@/lib/roles";

const getEnrollmentStatus = unstable_cache(
  async (userId: string) =>
    (await prisma.enrollment.count({
      where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    })) > 0,
  ["enrollment-status"],
  { revalidate: 300 }, // 5-minute cache per user; avoids a DB hit on every nav
);

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  // School-provisioned accounts (SCHOOL_STUDENT / SCHOOL_STAFF) hold NO B2C capability and must
  // never render the consumer dashboard: its shell carries a Messages tab and profile chrome, and a
  // school pupil is a child. Messaging never crosses the school boundary. Send them to their own
  // surface (/learn or /home). /home, /learn, /teach are real routes in the (school) group and
  // resolve on any host, so this relative redirect works everywhere and cannot loop (school /home
  // routes on by role).
  if (SCHOOL_ROLES.includes(session.user.role)) {
    redirect(DASHBOARD_ROUTES[session.user.role]);
  }

  let isEnrolled = true;
  if (session.user.role === "STUDENT") {
    isEnrolled = await getEnrollmentStatus(session.user.id);
  }

  return (
    <DashboardShell
      key={session.user.id}
      user={{
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        permissions: session.user.permissions,
      }}
      isEnrolled={isEnrolled}
    >
      {children}
    </DashboardShell>
  );
}
