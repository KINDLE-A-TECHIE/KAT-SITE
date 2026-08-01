import { redirect } from "next/navigation";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { SubmissionGrader } from "@/components/school/submission-grader";

/**
 * A teacher marking submissions for one assessment in one of their classes. Guarded by
 * requireActiveSchool([TEACHER]); the grading API re-checks that the class is this teacher's and that
 * the assessment is scheduled to it, so this page only avoids rendering a dead shell.
 */
export default async function GradeAssessmentPage({
  params,
}: {
  params: Promise<{ classId: string; assessmentId: string }>;
}) {
  try {
    await requireActiveSchool([SchoolRole.TEACHER]);
  } catch {
    redirect("/home");
  }

  const { classId, assessmentId } = await params;
  return (
    <section>
      <SubmissionGrader classId={classId} assessmentId={assessmentId} />
    </section>
  );
}
