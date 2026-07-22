import { redirect } from "next/navigation";
import { ensureSchoolStudent } from "@/lib/school";
import { LearnPanel } from "@/components/school/learn-panel";

/**
 * Student-inside-a-school shell.
 *
 * Guarded by ensureSchoolStudent (enrollment-based), NOT ensureSchoolMembership:
 * school students have no SchoolMembership row. SchoolRole is SCHOOL_ADMIN |
 * TEACHER only. Their school comes from Enrollment.schoolId.
 *
 * The licence gate itself is enforced in the API (and in the shared curriculum
 * routes), not here, a page-only gate would be bypassable.
 */
export default async function SchoolLearnPage() {
  try {
    await ensureSchoolStudent();
  } catch {
    redirect("/home");
  }

  return (
    <section className="space-y-6">
      <LearnPanel />
    </section>
  );
}
