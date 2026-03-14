import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { ContentReviewPanel } from "@/components/dashboard/content-review-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ContentReviewPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Content"
        title="Content Review"
        subtitle="Review, approve, or reject lesson content submitted by instructors before it goes live to learners."
      />
      <ContentReviewPanel />
    </section>
  );
}
