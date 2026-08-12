import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { guardDashboardCapability } from "@/lib/dashboard-capability";
import { MeetingsPanel } from "@/components/dashboard/meetings-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function MeetingsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  guardDashboardCapability(session.user, "sessions");

  const role = session.user.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isInstructor = role === "INSTRUCTOR";

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Live Sessions"
        title="Sessions & Meetings"
        subtitle={
          isAdmin
            ? "All scheduled classes and calls, with their recordings."
            : isInstructor
              ? "Schedule and host live classes and one-on-one sessions."
              : "Join upcoming classes and catch up on recordings you missed."
        }
      />
      <MeetingsPanel role={role} userId={session.user.id} />
    </section>
  );
}
