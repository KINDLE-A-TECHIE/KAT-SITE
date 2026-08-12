import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerAuthSession } from "@/lib/auth";
import { guardDashboardCapability } from "@/lib/dashboard-capability";
import { PageHeader } from "@/components/dashboard/page-header";
import { CertificatesPanel } from "@/components/dashboard/certificates-panel";

export const metadata: Metadata = { title: "Certificates | KAT Learning" };

export default async function CertificatesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  guardDashboardCapability(session.user, "curriculum");

  const { role } = session.user;
  const canIssue = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(role);

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Certificates"
        title={canIssue ? "Certificate Management" : "My Certificates"}
        subtitle={
          canIssue
            ? "Issue certificates to students and fellows who have completed a programme."
            : "Your certificates: download them or share the verification link."
        }
      />
      <div className="kat-card">
        <CertificatesPanel role={role} />
      </div>
    </section>
  );
}
