"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Code2, Download, FileDown, FileText, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv, type CsvValue } from "@/lib/export";

type UnitCoverage = {
  moduleId: string;
  order: number;
  label: string;
  strand: "CODING" | "DIGLIT";
  topicsInScheme: number | null;
  topicsOnPlatform: number;
  schemeCoveragePct: number | null;
  delivered: boolean;
  deliveredBy: string | null;
  basis: "FIRST_HAND" | "SUCCESSOR" | null;
  taughtByName: string | null;
  engagementPct: number;
  avgCompletedPerStudent: number;
};

type Section = {
  summary: {
    class: { id: string; name: string; term: string };
    course: { id: string; name: string } | null;
    studentCount: number;
    totalLessons: number;
    students: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      lessonsCompleted: number;
      gatesPassed: number;
      assessmentsTaken: number;
      avgScorePct: number | null;
    }>;
  };
  coverage: {
    className: string;
    matchedCrosswalk: boolean;
    teachers: Array<{ teacherName: string; from: string; to: string | null }>;
    units: UnitCoverage[];
    totals: {
      unitsInScheme: number | null;
      unitsOnPlatform: number;
      schemeCoveragePct: number | null;
      unitsDelivered: number;
      unitsFirstHand: number;
      unitsSuccessor: number;
      deliveredPct: number;
      engagementPct: number;
    };
  };
};

type Report = {
  school: { name: string };
  term: string | null;
  scope: "class" | "school";
  licence: { term: string; status: string; seatLimit: number; seatsUsed: number } | null;
  generatedAt: string;
  classes: Section[];
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * "Ngozi Okafor (12 Sep 2026 – 3 Nov 2026), Ada Balogun (3 Nov 2026 – present)".
 *
 * A class can change hands mid-term. Printing only the current teacher would imply she taught the
 * whole term, on a document a school may hand to an inspector. So every holder is named, with the
 * dates they held it, and the reader reconciles that against who attested each unit.
 */
function formatTeacherHistory(
  teachers: Array<{ teacherName: string; from: string; to: string | null }>,
): string {
  if (teachers.length === 0) return "No teacher assigned";
  if (teachers.length === 1 && teachers[0].to === null) return teachers[0].teacherName;
  return teachers
    .map((t) => `${t.teacherName} (${shortDate(t.from)} – ${t.to ? shortDate(t.to) : "present"})`)
    .join(", ");
}

export function ReportPanel({ terms, classes }: { terms: string[]; classes: Array<{ id: string; name: string; term: string }> }) {
  const [term, setTerm] = useState(terms[0] ?? "");
  const [classId, setClassId] = useState("ALL");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!term) return;
    setLoading(true);
    const q = new URLSearchParams({ term });
    if (classId !== "ALL") q.set("classId", classId);
    const res = await fetch(`/api/school/reports?${q.toString()}`);
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not build the report.");
      return;
    }
    setData(payload as Report);
  }, [term, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportStudents = () => {
    if (!data) return;
    const rows: CsvValue[][] = [
      ["Class", "Student", "Lessons completed", "Of total lessons", "Units mastered", "Assessments taken", "Average score %"],
    ];
    for (const s of data.classes) {
      for (const st of s.summary.students) {
        rows.push([
          s.summary.class.name,
          `${st.firstName} ${st.lastName}`,
          st.lessonsCompleted,
          s.summary.totalLessons,
          st.gatesPassed,
          st.assessmentsTaken,
          st.avgScorePct ?? "",
        ]);
      }
    }
    downloadCsv(`kat-students-${data.term ?? "term"}.csv`, rows);
  };

  const exportCoverage = () => {
    if (!data) return;
    const rows: CsvValue[][] = [
      [
        "Class",
        "Class teacher(s)",
        "Unit",
        "Strand",
        "Topics in NERDC scheme",
        "Topics on platform",
        "Scheme coverage %",
        "Delivered (teacher-attested)",
        "Basis",
        "Attested by",
        "Taught by (if second-hand)",
        "Student engagement %",
      ],
    ];
    for (const s of data.classes) {
      const taughtBy = formatTeacherHistory(s.coverage.teachers);
      for (const u of s.coverage.units) {
        rows.push([
          s.coverage.className,
          taughtBy,
          `${u.order}. ${u.label}`,
          u.strand === "CODING" ? "Coding" : "Digital literacy",
          u.topicsInScheme ?? "n/a",
          u.topicsOnPlatform,
          u.schemeCoveragePct === null ? "n/a" : u.schemeCoveragePct,
          u.delivered ? "Yes" : "No",
          !u.delivered ? "" : u.basis === "SUCCESSOR" ? "Second-hand (successor)" : "First-hand",
          u.deliveredBy ?? "",
          u.taughtByName ?? "",
          u.engagementPct,
        ]);
      }
    }
    downloadCsv(`kat-nerdc-coverage-${data.term ?? "term"}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Controls, hidden when printing */}
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-stone-500">Term</label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Choose a term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-stone-500">Scope</label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Whole school</SelectItem>
              {classes
                .filter((c) => !term || c.term === term)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportStudents} disabled={!data} className="gap-1.5">
            <Download className="size-4" />
            Students CSV
          </Button>
          <Button variant="outline" onClick={exportCoverage} disabled={!data} className="gap-1.5">
            <Download className="size-4" />
            Coverage CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!data} className="gap-1.5">
            <Printer className="size-4" />
            Print
          </Button>
          {term ? (
            <Button asChild className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800">
              <a
                href={`/api/school/reports/pdf?${new URLSearchParams(
                  classId !== "ALL" ? { term, classId } : { term },
                ).toString()}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown className="size-4" />
                Download PDF
              </a>
            </Button>
          ) : (
            <Button disabled className="gap-1.5 bg-orange-700 text-white">
              <FileDown className="size-4" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {loading ? <Skeleton className="h-96 w-full rounded-lg" /> : null}
      {!loading && !data ? null : null}

      {data ? (
        <article className="space-y-6">
          {/* Report header */}
          <header className="border-b border-stone-200 pb-4 dark:border-stone-800">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {data.school.name}
            </h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Progress &amp; NERDC coverage report · {data.term} ·{" "}
              {data.scope === "school" ? "whole school" : "single class"} · generated{" "}
              {new Date(data.generatedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {data.licence ? (
              <p className="mt-1 text-xs text-stone-400">
                Licence {data.licence.status} · {data.licence.seatsUsed}/{data.licence.seatLimit} seats
              </p>
            ) : null}
          </header>

          {/*
            THE KEY PANEL. Three figures, never blended: what the curriculum covers,
            what the teacher attests they taught, and what students actually did.
          */}
          <Card className="kat-card">
            <CardHeader>
              <CardTitle className="text-base">How to read this report</CardTitle>
              <CardDescription>
                Three separate measures. They answer different questions and must not be conflated.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="font-semibold text-stone-900 dark:text-stone-100">Scheme coverage</p>
                <p className="mt-0.5 text-stone-500 dark:text-stone-400">
                  Whether the platform carries every topic the NERDC scheme lists for the course.
                  A property of the curriculum.
                </p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 dark:text-stone-100">
                  Delivered <span className="font-normal text-orange-600">(teacher-attested)</span>
                </p>
                <p className="mt-0.5 text-stone-500 dark:text-stone-400">
                  Units the class teacher has marked as taught, and signed their name to. This is the
                  only record of teaching. Where a class changed hands, a unit may instead be marked{" "}
                  <span className="font-medium text-amber-700 dark:text-amber-500">second-hand</span>{" "}
                 , meaning a successor recorded that their predecessor taught it. Weaker evidence, shown
                  as such, and never counted as first-hand.
                </p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 dark:text-stone-100">Student engagement</p>
                <p className="mt-0.5 text-stone-500 dark:text-stone-400">
                  How much of the material students have worked through. It measures learning, not
                  teaching.
                </p>
              </div>
            </CardContent>
          </Card>

          {data.classes.length === 0 ? (
            <Card className="kat-card">
              <CardContent className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
                No classes for this term.
              </CardContent>
            </Card>
          ) : null}

          {data.classes.map((s) => (
            <section key={s.summary.class.id} className="space-y-4">
              <Card className="kat-card">
                <CardHeader>
                  <CardTitle className="text-base">{s.summary.class.name}</CardTitle>
                  <CardDescription>
                    {s.summary.course?.name ?? "No course assigned"} · {s.summary.studentCount}{" "}
                    student{s.summary.studentCount === 1 ? "" : "s"}
                  </CardDescription>
                  {/*
                    Named explicitly, with dates, because a class that changed hands mid-term must
                    not read as though one person taught all of it.
                  */}
                  <p className="pt-1 text-sm text-stone-600 dark:text-stone-300">
                    <span className="text-stone-400">Taught by:</span>{" "}
                    {formatTeacherHistory(s.coverage.teachers)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Headline figures */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Figure
                      label="Scheme coverage"
                      value={
                        s.coverage.totals.schemeCoveragePct === null
                          ? "n/a"
                          : `${s.coverage.totals.schemeCoveragePct}%`
                      }
                      note={
                        s.coverage.matchedCrosswalk
                          ? `${s.coverage.totals.unitsOnPlatform} of ${s.coverage.totals.unitsInScheme} scheme units`
                          : "Not a NERDC crosswalk course"
                      }
                    />
                    <Figure
                      label="Delivered"
                      value={`${s.coverage.totals.unitsDelivered}/${s.coverage.totals.unitsOnPlatform}`}
                      note={
                        s.coverage.totals.unitsSuccessor > 0
                          ? `${s.coverage.totals.unitsFirstHand} first-hand · ${s.coverage.totals.unitsSuccessor} second-hand`
                          : "Teacher-attested (first-hand)"
                      }
                      accent
                    />
                    <Figure
                      label="Student engagement"
                      value={`${s.coverage.totals.engagementPct}%`}
                      note="Lessons completed"
                    />
                  </div>

                  {/* Per unit */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[46rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400 dark:border-stone-800">
                          <th className="pb-2 font-medium">Unit</th>
                          <th className="pb-2 text-center font-medium">Strand</th>
                          <th className="pb-2 text-center font-medium">Scheme topics</th>
                          <th className="pb-2 text-center font-medium">On platform</th>
                          <th className="pb-2 text-center font-medium">Delivered</th>
                          <th className="pb-2 text-center font-medium">Engagement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                        {s.coverage.units.map((u) => (
                          <tr key={u.moduleId}>
                            <td className="py-2 pr-3 text-stone-800 dark:text-stone-200">
                              {u.order}. {u.label}
                            </td>
                            <td className="py-2 text-center">
                              <Badge
                                variant="secondary"
                                className="gap-1"
                              >
                                {u.strand === "CODING" ? (
                                  <Code2 className="size-3" />
                                ) : (
                                  <FileText className="size-3" />
                                )}
                                {u.strand === "CODING" ? "Coding" : "Dig. lit."}
                              </Badge>
                            </td>
                            <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                              {u.topicsInScheme ?? "n/a"}
                            </td>
                            <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                              {u.topicsOnPlatform}
                            </td>
                            <td className="py-2 text-center">
                              {!u.delivered ? (
                                <span className="inline-flex items-center gap-1 text-stone-400">
                                  <X className="size-3.5" />
                                  No
                                </span>
                              ) : u.basis === "SUCCESSOR" ? (
                                // Second-hand. Deliberately NOT the same green tick as a first-hand
                                // attestation, the reader must be able to see the difference at a
                                // glance, on the page, not only in the CSV.
                                <span
                                  className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-500"
                                  title={`Recorded by ${u.deliveredBy}, taught by ${u.taughtByName ?? "a predecessor"}`}
                                >
                                  <Check className="size-3.5" />
                                  Second-hand
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400"
                                  title={u.deliveredBy ? `Attested by ${u.deliveredBy}` : undefined}
                                >
                                  <Check className="size-3.5" />
                                  Yes
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                              {u.engagementPct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Students */}
              <Card className="kat-card">
                <CardHeader>
                  <CardTitle className="text-base">Students in {s.summary.class.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {s.summary.students.length === 0 ? (
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      No students on this roster.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[38rem] text-left text-sm">
                        <thead>
                          <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400 dark:border-stone-800">
                            <th className="pb-2 font-medium">Student</th>
                            <th className="pb-2 text-center font-medium">Lessons</th>
                            <th className="pb-2 text-center font-medium">Units mastered</th>
                            <th className="pb-2 text-center font-medium">Assessments</th>
                            <th className="pb-2 text-center font-medium">Avg score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                          {s.summary.students.map((st) => (
                            <tr key={st.userId}>
                              <td className="py-2 pr-3 font-medium text-stone-900 dark:text-stone-100">
                                {st.firstName} {st.lastName}
                              </td>
                              <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                                {st.lessonsCompleted}
                                {s.summary.totalLessons > 0 ? `/${s.summary.totalLessons}` : ""}
                              </td>
                              <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                                {st.gatesPassed}
                              </td>
                              <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                                {st.assessmentsTaken}
                              </td>
                              <td className="py-2 text-center font-medium text-stone-800 dark:text-stone-200">
                                {st.avgScorePct === null ? (
                                  <span className="font-normal text-stone-400">·</span>
                                ) : (
                                  `${st.avgScorePct}%`
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          ))}

          <footer className="border-t border-stone-200 pt-4 text-xs text-stone-400 dark:border-stone-800">
            &ldquo;Delivered&rdquo; figures are attested by the named class teacher. Where a class
            changed hands during the term, every teacher who held it is listed with the dates. Each
            unit remains attributed to the teacher who actually attested it, and attestations are
            never reassigned. A unit marked <em>second-hand</em> was recorded by a successor on a
            predecessor&rsquo;s behalf; it is counted separately and is not evidence of the
            successor&rsquo;s own teaching. Scheme coverage is measured against the NERDC scheme of work.
            Student engagement is derived from lesson completions and does not, on its own,
            evidence teaching.
          </footer>
        </article>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent ? "text-orange-600" : "text-stone-900 dark:text-stone-100"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-stone-400">{note}</p>
    </div>
  );
}
