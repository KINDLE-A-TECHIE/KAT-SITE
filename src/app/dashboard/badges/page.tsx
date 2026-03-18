import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerAuthSession } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { BadgesPanel } from "@/components/dashboard/badges-panel";

export const metadata: Metadata = { title: "Badges | KAT Learning" };

export default async function BadgesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const { role } = session.user;
  if (!["STUDENT", "FELLOW"].includes(role)) redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Badges"
        title="My Badges"
        subtitle="Badges are awarded automatically when you pass all assessments in a module."
      />
      <div className="kat-card">
        <BadgesPanel />
      </div>
    </section>
  );
}
