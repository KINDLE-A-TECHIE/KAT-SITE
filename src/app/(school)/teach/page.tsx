import { redirect } from "next/navigation";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { TeachClassesPanel } from "@/components/school/teach-classes-panel";

/** TEACHER shell: the classes this teacher delivers. */
export default async function SchoolTeachPage() {
  try {
    await requireActiveSchool([SchoolRole.TEACHER]);
  } catch {
    redirect("/home");
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Teaching</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          Your classes
        </h1>
      </header>

      {/* Panel reads /api/school/teach/classes, scoped to schoolId AND teacherId. */}
      <TeachClassesPanel />
    </section>
  );
}
