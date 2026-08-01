import { redirect } from "next/navigation";
import { ensureSchoolStudent } from "@/lib/school";
import { AssessmentsList } from "@/components/school/assessments-list";

/**
 * A school pupil's tests and exams. Guarded by ensureSchoolStudent; the API enforces the real gates
 * (scheduled to their class, within window, licensed term), this only avoids a dead shell.
 */
export default async function SchoolAssessmentsPage() {
  try {
    await ensureSchoolStudent();
  } catch {
    redirect("/home");
  }

  return (
    <section>
      <AssessmentsList />
    </section>
  );
}
