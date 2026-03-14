import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerAuthSession } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import type { UserRoleValue } from "@/lib/enums";

export const metadata: Metadata = { title: "Settings · KAT Academy" };

export default async function SettingsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-5">
      <PageHeader
        badge="Account Settings"
        title="Settings"
        subtitle="Manage your password, notifications, appearance, and active sessions."
      />
      <SettingsPanel role={session.user.role as UserRoleValue} />
    </div>
  );
}
