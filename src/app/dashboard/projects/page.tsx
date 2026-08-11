import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { guardDashboardCapability } from "@/lib/dashboard-capability";
import { ProjectsPanel } from "@/components/dashboard/projects-panel";

export const metadata = { title: "Projects | KAT Learning" };

export default async function ProjectsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  guardDashboardCapability(session.user, "projects");

  return <ProjectsPanel role={session.user.role} />;
}
