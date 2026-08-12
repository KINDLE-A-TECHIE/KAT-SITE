import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { guardDashboardCapability } from "@/lib/dashboard-capability";
import { AssessmentsPanel } from "@/components/dashboard/assessments-panel";
import { PageHeader } from "@/components/dashboard/page-header";

const LEARNER_ROLES: string[] = [UserRole.STUDENT, UserRole.FELLOW];

export default async function AssessmentsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  guardDashboardCapability(session.user, "assessments");

  const isLearner = LEARNER_ROLES.includes(session.user.role);

  return (
    <section className="space-y-4">
      <PageHeader
        badge={isLearner ? "Learning" : "Assessment Centre"}
        title={isLearner ? "My Assessments" : "Assessments"}
        subtitle={
          isLearner
            ? "Complete your quizzes, assignments, and exams. Your scores and feedback appear on the Grades page."
            : "Build tests and project briefs. Multiple choice grades itself; the rest goes to manual grading."
        }
      />
      <AssessmentsPanel role={session.user.role} />
    </section>
  );
}
