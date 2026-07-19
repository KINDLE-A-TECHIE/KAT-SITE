import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { ReportPanel } from "@/components/school/report-panel";
import type { SchoolMembershipClaim } from "@/lib/rbac";

/**
 * The termly progress & NERDC-coverage report, the artifact a proprietor buys.
 *
 * SCHOOL_ADMIN only; scoped strictly to their own school. Not licence-gated: an admin
 * whose term has lapsed must still be able to pull the report for a term they DID pay
 * for (and reach billing).
 */
export default async function SchoolReportsPage() {
  let membership: SchoolMembershipClaim;
  try {
    membership = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]);
  } catch {
    redirect("/home");
  }

  // TENANT ISOLATION: the term and class options come from this school only.
  const classes = await prisma.schoolClass.findMany({
    where: { schoolId: membership.schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, term: true },
  });

  const terms = [...new Set(classes.map((c) => c.term))].sort();

  return (
    <section className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 print:hidden dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        Back to overview
      </Link>

      {terms.length === 0 ? (
        <p className="rounded-lg bg-stone-50 p-6 text-sm text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
          Create a class first. Reports are produced per term.
        </p>
      ) : (
        <ReportPanel terms={terms} classes={classes} />
      )}
    </section>
  );
}
