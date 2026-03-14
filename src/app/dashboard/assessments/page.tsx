import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { AssessmentsPanel } from "@/components/dashboard/assessments-panel";
import { PageHeader } from "@/components/dashboard/page-header";

const LEARNER_ROLES: string[] = [UserRole.STUDENT, UserRole.FELLOW];

export default async function AssessmentsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const isLearner = LEARNER_ROLES.includes(session.user.role);

  return (
    <section className="space-y-4">
      <PageHeader
        badge={isLearner ? "Learning" : "Assessment Centre"}
        title={isLearner ? "My Assessments" : "Assessments"}
        subtitle={
          isLearner
            ? "Complete your quizzes, assignments, and exams. Your scores and feedback appear on the Grades page."
            : "Build objective tests and reviewed projects. Scores auto-apply for multiple choice; flag complex submissions for manual grading."
        }
      />
      <AssessmentsPanel role={session.user.role} />
    </section>
  );
}
