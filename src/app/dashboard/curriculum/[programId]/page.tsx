import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { CurriculumTree } from "@/components/dashboard/curriculum-tree";

interface Props { params: Promise<{ programId: string }> }

export default async function CurriculumProgramPage({ params }: Props) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const { programId } = await params;
  return <CurriculumTree programId={programId} role={session.user.role} />;
}