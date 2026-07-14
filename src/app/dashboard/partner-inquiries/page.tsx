import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { PartnerInquiriesPanel } from "@/components/dashboard/partner-inquiries-panel";
import { PageHeader } from "@/components/dashboard/page-header";

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

export default async function PartnerInquiriesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (!ADMIN_ROLES.includes(session.user.role)) redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Leads"
        title="Partner Inquiries"
        subtitle="Incoming partnership and school pilot enquiries from the marketing site. Triage each lead and track its status."
      />
      {/* Provisioning a school is a SUPER_ADMIN action; ADMINs can still triage leads. */}
      <PartnerInquiriesPanel canProvision={session.user.role === UserRole.SUPER_ADMIN} />
    </section>
  );
}
