import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { ChildrenPanel } from "@/components/dashboard/children-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ChildrenPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.PARENT) redirect("/dashboard");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Family"
        title="My Children"
        subtitle="Register a new student account or link an existing one. Manage payments and track each child's progress from here."
      />
      <ChildrenPanel />
    </section>
  );
}
