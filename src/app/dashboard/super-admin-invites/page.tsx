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
        subtitle="Generate invite links, onboard team members, and manage admin and instructor accounts across the platform."
      />
      <SuperAdminInvitesPanel />
      <AdminAccessPanel />
    </section>
  );
}
