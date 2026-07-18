import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Users, Armchair, ReceiptText, FileBarChart } from "lucide-react";
import { SchoolRole, SchoolLicenseStatus } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import type { SchoolMembershipClaim } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SchoolClassesPanel } from "@/components/school/school-classes-panel";
import { RosterImportPanel } from "@/components/school/roster-import-panel";

const LICENCE_BADGE: Record<SchoolLicenseStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400",
  PENDING: "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400",
  EXPIRED: "bg-stone-200 text-stone-600 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300",
  CANCELLED: "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400",
};

/** SCHOOL_ADMIN overview: classes, seats, current-term licence. */
export default async function SchoolAdminPage() {
  let membership: SchoolMembershipClaim;
  try {
    membership = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]);
  } catch {
    // Wrong role / no membership → /home routes them to the right shell.
    redirect("/home");
  }

  // TENANT ISOLATION: every query below is filtered by this schoolId. No exceptions.
  const { schoolId } = membership;

  // The classes list itself is owned by SchoolClassesPanel (it reads
  // /api/school/classes so it can refresh after a create/edit without a full reload).
  const [school, classCount, teacherCount, studentCount, licences] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
    prisma.schoolClass.count({ where: { schoolId } }),
    prisma.schoolMembership.count({ where: { schoolId, role: SchoolRole.TEACHER } }),
    prisma.enrollment.count({ where: { schoolId } }),
    prisma.schoolLicense.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      select: { term: true, status: true, seatLimit: true, seatsUsed: true, pricePerSeat: true },
    }),
  ]);

  // "Current term" = the ACTIVE licence if there is one, else the most recent.
  // (There is no term calendar in the schema yet; this is the agreed resolution.)
  const licence = licences.find((l) => l.status === SchoolLicenseStatus.ACTIVE) ?? licences[0] ?? null;
  const seatPct =
    licence && licence.seatLimit > 0
      ? Math.min(100, Math.round((licence.seatsUsed / licence.seatLimit) * 100))
      : 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
            School admin
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
            {school?.name ?? "Your school"}
          </h1>
        </div>
        {/* Always reachable, even with a lapsed licence, this is how the school pays. */}
        <div className="flex gap-2">
        <Link
          href="/admin/teachers"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200"
        >
          <Users className="size-4" />
          Teachers
        </Link>
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200"
        >
          <FileBarChart className="size-4" />
          Reports
        </Link>
        <Link
          href="/admin/billing"
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-800"
        >
          <ReceiptText className="size-4" />
          Billing &amp; seats
        </Link>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<GraduationCap className="size-4" />} label="Classes" value={classCount} />
        <StatCard icon={<Users className="size-4" />} label="Teachers" value={teacherCount} />
        <StatCard icon={<Users className="size-4" />} label="Students" value={studentCount} />
        <StatCard
          icon={<Armchair className="size-4" />}
          label="Seats used"
          value={licence ? `${licence.seatsUsed} / ${licence.seatLimit}` : "n/a"}
          note={licence ? undefined : "No licence yet"}
        />
      </div>

      {/* Current-term licence */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="size-4 text-orange-600" />
              Current-term licence
            </CardTitle>
            <CardDescription>
              {licence
                ? `Term ${licence.term} · ₦${Number(licence.pricePerSeat).toLocaleString("en-NG")} per seat`
                : "Seats unlock once a term licence is paid and active."}
            </CardDescription>
          </div>
          {licence ? (
            <Badge className={LICENCE_BADGE[licence.status]}>{licence.status}</Badge>
          ) : null}
        </CardHeader>

        {licence ? (
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-stone-600 dark:text-stone-300">
                <strong className="font-semibold text-stone-900 dark:text-stone-100">
                  {licence.seatsUsed}
                </strong>{" "}
                of {licence.seatLimit} seats used
              </span>
              <span className="text-xs text-stone-400">{seatPct}%</span>
            </div>
            <Progress value={seatPct} className="h-2" />
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No licence has been issued for this school yet. Once a term is invoiced and paid, your
              seats and class access activate here.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Classes, create/edit + teacher assignment (client, reads /api/school/classes) */}
      <SchoolClassesPanel />

      {/* Roster import. CSV parsed server-side; no student PII in URLs */}
      <RosterImportPanel />
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
          <span className="text-orange-600">{icon}</span>
          {label}
        </div>
        <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">{value}</p>
        {note ? <p className="mt-0.5 text-xs text-stone-400">{note}</p> : null}
      </CardContent>
    </Card>
  );
}
