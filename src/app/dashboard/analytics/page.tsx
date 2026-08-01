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
            ? "Enrolment, revenue, activity, and risk signals."
            : "Your login activity and submission history."
        }
      />
      <AnalyticsPanel />
    </section>
  );
}
