import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { CurriculumPanel } from "@/components/dashboard/curriculum-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function CurriculumPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const isLearner = ["STUDENT", "FELLOW"].includes(session.user.role);

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Curriculum"
        title="Programmes & Curriculum"
        subtitle={
          isLearner
            ? "Your programmes, their modules, and the lessons inside."
            : "Build programmes, modules, and lesson content."
        }
      />
      <CurriculumPanel role={session.user.role} />
    </section>
  );
}
