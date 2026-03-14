import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { FellowApplicationsPanel } from "@/components/dashboard/fellow-applications-panel";
import { PageHeader } from "@/components/dashboard/page-header";

const ALLOWED: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

export default async function FellowApplicationsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (!ALLOWED.includes(session.user.role as UserRole)) redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Fellowship"
        title="Fellow Applications"
        subtitle="Review applications from students ready to become mentors. Approved applicants are automatically promoted to the Fellow role."
      />
      <FellowApplicationsPanel />
    </section>
  );
}
