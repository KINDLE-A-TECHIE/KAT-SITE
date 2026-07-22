import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense } from "@/lib/school-license";
import { prisma } from "@/lib/prisma";
import { ClassResultsPanel } from "@/components/school/class-results-panel";
import { UnitDeliveryPanel } from "@/components/school/unit-delivery-panel";
import { StartClassPanel } from "@/components/school/start-class-panel";
import { TeacherPreviewPanel } from "@/components/school/teacher-preview-panel";
import type { SchoolMembershipClaim } from "@/lib/rbac";

/**
 * One class's roster + per-student progress.
 *
 * Guarded twice: TEACHER of this school (ensureSchoolMembership via
 * requireActiveSchool), AND the class must be scoped to schoolId + teacherId,
 * so a teacher cannot open a colleague's class by guessing its id.
 */
export default async function TeachClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  let membership: SchoolMembershipClaim;
  try {
    membership = await requireActiveSchool([SchoolRole.TEACHER]);
  } catch {
    redirect("/home");
  }

  const { classId } = await params;
  const session = await getServerAuthSession();

  const owns = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId: membership.schoolId, teacherId: session!.user.id },
    select: { id: true, sessionLabel: true, programId: true, nerdcLevel: true },
  });
  if (!owns) redirect("/teach");

  // LICENCE GATE, a teacher cannot open a class whose session is not licensed, even by
  // typing the URL. The API enforces this too; this only avoids rendering a shell
  // whose data request would 403.
  const gate = await checkClassLicense(membership.schoolId, owns.sessionLabel);
  if (!gate.allowed) redirect("/teach");

  return (
    <section className="space-y-6">
      <Link
        href="/teach"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        All classes
      </Link>

      {/* Roster, per-term results and per-student mastery, reads /api/school/results,
          the same payload the Phase 4 termly report renders. */}
      {/* Teacher-attested scheme delivery, the only record of TEACHING, and what the
          school's NERDC coverage report reports. */}
      <StartClassPanel classId={classId} />

      <UnitDeliveryPanel classId={classId} />

      <TeacherPreviewPanel
        classId={classId}
        schoolId={membership.schoolId}
        sessionLabel={owns.sessionLabel}
        programId={owns.programId}
        nerdcLevel={owns.nerdcLevel}
      />

      <ClassResultsPanel classId={classId} />
    </section>
  );
}
