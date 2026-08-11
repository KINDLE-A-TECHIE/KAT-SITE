import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { guardDashboardCapability } from "@/lib/dashboard-capability";
import { ChallengesPanel } from "@/components/dashboard/challenges-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ChallengesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  guardDashboardCapability(session.user, "challenges");

  const role = session.user.role;

  const isLearner = role === "STUDENT" || role === "FELLOW";

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Challenges"
        title={isLearner ? "Weekly Challenges 🔥" : "Challenge Centre"}
        subtitle={
          isLearner
            ? "Take on this week's challenge and see where you rank."
            : "Create weekly challenges and score what students submit."
        }
      />
      <ChallengesPanel role={role} />
    </section>
  );
}
