import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { MeetingsPanel } from "@/components/dashboard/meetings-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function MeetingsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

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
            ? "Oversee all scheduled classes and mentorship calls. Monitor attendance and access recordings."
            : isInstructor
              ? "Host live classes, 1-on-1 reviews, and group sessions for your learners using Zoho Meeting."
              : "Join your upcoming live classes and mentorship calls. Catch up on recordings you missed."
        }
      />
      <MeetingsPanel role={role} userId={session.user.id} />
    </section>
  );
}
