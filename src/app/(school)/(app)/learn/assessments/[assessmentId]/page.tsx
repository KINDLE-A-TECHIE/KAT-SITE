import { redirect } from "next/navigation";
import { ensureSchoolStudent } from "@/lib/school";
import { AssessmentTake } from "@/components/school/assessment-take";

/**
 * A school pupil sitting one test/exam. Guarded by ensureSchoolStudent; every real check (scheduled to
 * their class, open window, licensed term, single attempt) lives in the API the take component calls.
 */
export default async function SchoolAssessmentTakePage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  try {
    await ensureSchoolStudent();
  } catch {
    redirect("/home");
  }

  const { assessmentId } = await params;
  return (
    <section>
      <AssessmentTake assessmentId={assessmentId} />
    </section>
  );
}
