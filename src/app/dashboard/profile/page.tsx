import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { ProfilePanel } from "@/components/dashboard/profile-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ProfilePage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Profile"
        title="My Profile"
        subtitle="Your photo, contact details, background, skills, and visibility settings."
      />
      <ProfilePanel />
    </section>
  );
}
