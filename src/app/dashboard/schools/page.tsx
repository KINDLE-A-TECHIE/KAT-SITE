import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { ManageSchoolsPanel } from "@/components/dashboard/manage-schools-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ManageSchoolsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.SUPER_ADMIN) redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Schools"
        title="Manage Schools"
        subtitle="Set each school's per-seat price and monitor seats, revenue, and enrolment across every tenant."
      />
      <ManageSchoolsPanel />
    </section>
  );
}
