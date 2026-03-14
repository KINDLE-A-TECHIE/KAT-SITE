import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerAuthSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      key={session.user.id}
      user={{
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
      }}
    >
      {children}
    </DashboardShell>
  );
}
