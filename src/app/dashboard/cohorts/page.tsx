import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerAuthSession } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { CohortsPanel } from "@/components/dashboard/cohorts-panel";

export const metadata: Metadata = { title: "Cohorts | KAT Learning" };

export default async function CohortsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Cohorts"
        title="Cohort Management"
        subtitle="Open and close fellowship applications, set fees, and manage cohort intake dates."
      />
      <div className="kat-card">
        <CohortsPanel />
      </div>
    </section>
  );
}
