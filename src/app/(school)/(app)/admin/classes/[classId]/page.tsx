import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { ClassResultsPanel } from "@/components/school/class-results-panel";
import type { SchoolMembershipClaim } from "@/lib/rbac";

/**
 * SCHOOL_ADMIN view of one class's results + per-student mastery.
 *
 * Same panel and same API as the teacher's view, the difference is only the scope:
 * a school admin may open ANY class in their school (scoped by schoolId), whereas a
 * teacher is additionally scoped to teacherId.
 */
export default async function AdminClassResultsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  let membership: SchoolMembershipClaim;
  try {
    membership = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]);
  } catch {
    redirect("/home");
  }

  const { classId } = await params;

  // TENANT ISOLATION: another school's class simply does not exist to this admin.
  const owned = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId: membership.schoolId },
    select: { id: true },
  });
  if (!owned) redirect("/admin");

  return (
    <section className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        Back to overview
      </Link>

      <ClassResultsPanel classId={classId} />
    </section>
  );
}
