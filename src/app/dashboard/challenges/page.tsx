import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { ChallengesPanel } from "@/components/dashboard/challenges-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ChallengesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  const isLearner = role === "STUDENT" || role === "FELLOW";

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Challenges"
        title={isLearner ? "Weekly Challenges 🔥" : "Challenge Centre"}
        subtitle={
          isLearner
            ? "Complete this week's challenge, earn points, and climb the leaderboard!"
            : "Create and manage weekly challenges for each program module."
        }
      />
      <ChallengesPanel role={role} />
    </section>
  );
}
