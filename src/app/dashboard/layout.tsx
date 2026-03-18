import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerAuthSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { prisma } from "@/lib/prisma";

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
      }}
      isEnrolled={isEnrolled}
    >
      {children}
    </DashboardShell>
  );
}
