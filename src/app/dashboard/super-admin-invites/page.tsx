import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { SuperAdminInvitesPanel } from "@/components/dashboard/super-admin-invites-panel";
import { AdminAccessPanel } from "@/components/dashboard/admin-access-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function SuperAdminInvitesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.SUPER_ADMIN) redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Admin Access"
        title="Staff & Access Control"
        subtitle="Invite admins and instructors, and manage their accounts."
      />
      <SuperAdminInvitesPanel />
      <AdminAccessPanel />
    </section>
  );
}
