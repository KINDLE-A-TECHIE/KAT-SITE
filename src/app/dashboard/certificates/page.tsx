import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerAuthSession } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { CertificatesPanel } from "@/components/dashboard/certificates-panel";

export const metadata: Metadata = { title: "Certificates | KAT Academy" };

export default async function CertificatesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

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
            : "Your earned certificates — view, download, or share them with the world."
        }
      />
      <div className="kat-card">
        <CertificatesPanel role={role} />
      </div>
    </section>
  );
}
