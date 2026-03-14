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
            ? "Explore your enrolled programmes, browse modules, and work through your lessons at your own pace."
            : "Manage published programmes, build modules, and create lesson content for your learners."
        }
      />
      <CurriculumPanel role={session.user.role} />
    </section>
  );
}
