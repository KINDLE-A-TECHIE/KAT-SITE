import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function AnalyticsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const canViewPlatform =
    session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;

  return (
    <section className="space-y-4">
      <PageHeader
        badge={canViewPlatform ? "Platform Insights" : "My Progress"}
        title={canViewPlatform ? "Analytics" : "Your Analytics"}
        subtitle={
          canViewPlatform
            ? "Enrolment trends, revenue, activity heatmaps, and risk signals across the entire academy."
            : "Your login activity, submission history, and learning trajectory at a glance."
        }
      />
      <AnalyticsPanel />
    </section>
  );
}
