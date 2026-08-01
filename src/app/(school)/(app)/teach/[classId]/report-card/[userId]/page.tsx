import { redirect } from "next/navigation";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { ReportCard } from "@/components/school/report-card";

/**
 * A pupil's printable term report card. Guarded by requireActiveSchool([TEACHER]); the term-results API
 * re-checks that the class is this teacher's. The pupil is addressed by opaque id, never name/email.
 */
export default async function ReportCardPage({
  params,
}: {
  params: Promise<{ classId: string; userId: string }>;
}) {
  try {
    await requireActiveSchool([SchoolRole.TEACHER]);
  } catch {
    redirect("/home");
  }

  const { classId, userId } = await params;
  return (
    <section>
      <ReportCard classId={classId} userId={userId} />
    </section>
  );
}
