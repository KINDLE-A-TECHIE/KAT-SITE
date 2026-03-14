import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { MessagesPanel } from "@/components/dashboard/messages-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function MessagesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Messages"
        title="Your Inbox"
        subtitle="Direct chats, group threads, and class channels — all in one place."
      />
      <MessagesPanel currentUserId={session.user.id} currentUserRole={session.user.role} />
    </section>
  );
}
