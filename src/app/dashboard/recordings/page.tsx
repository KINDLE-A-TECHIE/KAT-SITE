import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerAuthSession } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { StageRecordingsPanel } from "@/components/dashboard/stage-recordings-panel";

export const metadata: Metadata = { title: "Recordings | KAT Learning" };

export default async function RecordingsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const { role } = session.user;
  if (!["STUDENT", "FELLOW"].includes(role)) redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Recordings"
        title="My Recordings"
        subtitle="Stage videos you saved from the Scratch editor. Play, download, or delete them here."
      />
      <div className="kat-card">
        <StageRecordingsPanel heading="All your recordings" />
      </div>
    </section>
  );
}
