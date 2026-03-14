import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { CurriculumVersionsPanel } from "@/components/dashboard/curriculum-versions-panel";

interface Props { params: Promise<{ programId: string }> }

export default async function CurriculumVersionsPage({ params }: Props) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") redirect("/dashboard/curriculum");

  const { programId } = await params;
  return <CurriculumVersionsPanel programId={programId} role={role} />;
}