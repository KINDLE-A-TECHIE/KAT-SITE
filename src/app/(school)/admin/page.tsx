import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ReceiptText, FileBarChart } from "lucide-react";
import { SchoolRole, SchoolLicenseStatus } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { formatTerm } from "@/lib/school-term";
import type { SchoolMembershipClaim } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatLedger, StatusDot } from "@/components/stat-ledger";
import { SchoolClassesPanel } from "@/components/school/school-classes-panel";
import { RosterImportPanel } from "@/components/school/roster-import-panel";

// Status reads as text + a dot, not a pastel pill.
const LICENCE_TONE: Record<SchoolLicenseStatus, "pine" | "sun" | "clay" | "muted"> = {
  ACTIVE: "pine",
  PENDING: "sun",
  EXPIRED: "muted",
  CANCELLED: "clay",
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
      select: { sessionLabel: true, termNumber: true, status: true, seatLimit: true, seatsUsed: true, pricePerSeat: true },
    }),
  ]);

  // "Current term" = the ACTIVE licence if there is one, else the most recent.
  const licence = licences.find((l) => l.status === SchoolLicenseStatus.ACTIVE) ?? licences[0] ?? null;
  const seatPct =
    licence && licence.seatLimit > 0
      ? Math.min(100, Math.round((licence.seatsUsed / licence.seatLimit) * 100))
      : 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-orange-700 dark:text-orange-500">
            School admin
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
            {school?.name ?? "Your school"}
          </h1>
        </div>
        {/* Always reachable, even with a lapsed licence, this is how the school pays. */}
        <div className="flex gap-2">
        <Link
          href="/admin/teachers"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-200"
        >
          <Users className="size-4" />
          Teachers
        </Link>
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-200"
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

      {/* Stat ledger: one flat container, mono numerals, hairline dividers. */}
      <StatLedger
        columns={4}
        entries={[
          { label: "Classes", value: classCount },
          { label: "Teachers", value: teacherCount },
          { label: "Students", value: studentCount },
          {
            label: "Seats used",
            value: licence ? `${licence.seatsUsed} / ${licence.seatLimit}` : "n/a",
            hint: licence ? undefined : "No licence yet",
          },
        ]}
      />

      {/* Current-term licence */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="size-4 text-orange-600" />
              Current-term licence
            </CardTitle>
            <CardDescription className="font-mono text-xs tabular-nums">
              {licence
                ? `${formatTerm(licence.sessionLabel, licence.termNumber)} · ₦${Number(licence.pricePerSeat).toLocaleString("en-NG")} per seat`
                : "Seats unlock once a term licence is paid and active."}
            </CardDescription>
          </div>
          {licence ? (
            <StatusDot tone={LICENCE_TONE[licence.status]} label={licence.status} />
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
              <span className="font-mono text-xs tabular-nums text-stone-400">{seatPct}%</span>
            </div>
            {/* Seat bar: pine while healthy, sun near the limit, clay at or over it. */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
              <div
                className={`h-full rounded-full ${
                  seatPct >= 100
                    ? "bg-[var(--kat-clay)]"
                    : seatPct >= 80
                      ? "bg-[var(--kat-sun)]"
                      : "bg-[var(--kat-pine)]"
                }`}
                style={{ width: `${seatPct}%` }}
              />
            </div>
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
