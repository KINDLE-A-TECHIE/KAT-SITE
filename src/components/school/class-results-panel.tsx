"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Code2, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type AssessmentResult = {
  id: string;
  title: string;
  totalPoints: number;
  passScore: number;
  submitted: number;
  graded: number;
  avgPct: number | null;
  passRate: number | null;
};

type TermSummary = {
  moduleId: string;
  label: string;
  strand: "CODING" | "DIGLIT";
  lessons: { total: number; avgCompleted: number; completionPct: number };
  mastery: { studentsAllGatesPassed: number } | null;
  assessments: AssessmentResult[];
};

type StudentSummary = {
  userId: string;
  firstName: string;
  lastName: string;
  lessonsCompleted: number;
  gatesPassed: number;
  assessmentsTaken: number;
  avgScorePct: number | null;
  lastScorePct: number | null;
};

type Summary = {
  class: { id: string; name: string; term: string };
  course: { id: string; name: string } | null;
  studentCount: number;
  totalLessons: number;
  terms: TermSummary[];
  students: StudentSummary[];
};

export function ClassResultsPanel({ classId }: { classId: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Only the CLASS id is in the query, never a student's id or name.
      const res = await fetch(`/api/school/results?classId=${encodeURIComponent(classId)}`);
      const payload = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        toast.error(payload?.error ?? "Could not load results.");
        setLoading(false);
        return;
      }
      setData(payload as Summary);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (loading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (!data) return null;

  const noCourse = !data.course;
  const noCurriculum = data.totalLessons === 0 && data.terms.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Results &amp; mastery
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          {data.class.name}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Term {data.class.term} · {data.course?.name ?? "No course assigned"} ·{" "}
          {data.studentCount} student{data.studentCount === 1 ? "" : "s"}
        </p>
      </header>

      {/* Honest empty states, no invented scores. */}
      {noCourse ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Assign a course to this class to start tracking results.
            </p>
          </CardContent>
        </Card>
      ) : noCurriculum ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No curriculum has been published for this course yet, so there is nothing to assess.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Per term (the scheme's Term 1/2/3) */}
      {data.terms.map((t) => {
        const isCoding = t.strand === "CODING";
        return (
          <Card key={t.moduleId}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">{t.label}</CardTitle>
                <CardDescription>
                  {t.lessons.total > 0
                    ? `${t.lessons.avgCompleted} of ${t.lessons.total} lessons completed on average`
                    : "No lessons in this unit"}
                  {t.mastery ? ` · ${t.mastery.studentsAllGatesPassed} of ${data.studentCount} mastered` : ""}
                </CardDescription>
              </div>
              <Badge
                className={
                  isCoding
                    ? "gap-1.5 bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400"
                    : "gap-1.5 bg-stone-100 text-stone-600 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300"
                }
              >
                {isCoding ? <Code2 className="size-3" /> : <FileText className="size-3" />}
                {isCoding ? "Coding" : "Digital literacy"}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              {t.lessons.total > 0 ? (
                <div className="flex items-center gap-3">
                  <Progress value={t.lessons.completionPct} className="h-2 flex-1" />
                  <span className="w-12 shrink-0 text-right text-xs text-stone-400">
                    {t.lessons.completionPct}%
                  </span>
                </div>
              ) : null}

              {t.assessments.length === 0 ? (
                <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
                  No published assessment for this unit yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400 dark:border-stone-800">
                        <th className="pb-2 font-medium">Assessment</th>
                        <th className="pb-2 text-center font-medium">Submitted</th>
                        <th className="pb-2 text-center font-medium">Graded</th>
                        <th className="pb-2 text-center font-medium">Avg</th>
                        <th className="pb-2 text-center font-medium">Pass rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {t.assessments.map((a) => (
                        <tr key={a.id}>
                          <td className="py-2 pr-3 text-stone-800 dark:text-stone-200">{a.title}</td>
                          <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                            {a.submitted}/{data.studentCount}
                          </td>
                          <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                            {a.graded}
                          </td>
                          <td className="py-2 text-center font-medium text-stone-800 dark:text-stone-200">
                            {a.avgPct === null ? "n/a" : `${a.avgPct}%`}
                          </td>
                          <td className="py-2 text-center">
                            {a.passRate === null ? (
                              <span className="text-stone-400">·</span>
                            ) : (
                              <span
                                className={
                                  a.passRate >= 50
                                    ? "font-medium text-emerald-700 dark:text-emerald-400"
                                    : "font-medium text-rose-700 dark:text-rose-400"
                                }
                              >
                                {a.passRate}%
                              </span>
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
        );
      })}

      {/* Per student */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>
            {data.students.length === 0
              ? "No students on this roster yet."
              : `${data.students.length} student${data.students.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.students.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-4 text-sm leading-relaxed text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
              Once students are imported into this class, their results and mastery appear here.
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
                  {data.students.map((s) => (
                    <tr key={s.userId}>
                      <td className="py-2 pr-3 font-medium text-stone-900 dark:text-stone-100">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                        {s.lessonsCompleted}
                        {data.totalLessons > 0 ? `/${data.totalLessons}` : ""}
                      </td>
                      <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                        {s.gatesPassed}
                      </td>
                      <td className="py-2 text-center text-stone-500 dark:text-stone-400">
                        {s.assessmentsTaken}
                      </td>
                      <td className="py-2 text-center font-medium text-stone-800 dark:text-stone-200">
                        {s.avgScorePct === null ? (
                          <span className="font-normal text-stone-400">No score yet</span>
                        ) : (
                          `${s.avgScorePct}%`
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
    </div>
  );
}
