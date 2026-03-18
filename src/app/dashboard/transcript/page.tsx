"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AssessmentType = "QUIZ" | "EXAM" | "ASSIGNMENT" | "PROJECT";
type SubmissionStatus = "SUBMITTED" | "GRADED" | "IN_REVIEW";

type AssessmentRecord = {
  id: string;
  title: string;
  type: AssessmentType;
  passScore: number;
  totalPoints: number;
  dueDate: string | null;
  submissions: {
    id: string;
    status: SubmissionStatus;
    totalScore: number;
    autoScore: number;
    manualScore: number;
    submittedAt: string;
    gradedAt: string | null;
    feedback: string | null;
  }[];
};

type EnrollmentRecord = {
  id: string;
  status: string;
  enrolledAt: string;
  cohort: { id: string; name: string; startsAt: string | null; endsAt: string | null } | null;
  program: { id: string; name: string; assessments: AssessmentRecord[] };
};

type TranscriptUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: string;
  enrollments: EnrollmentRecord[];
};

type TranscriptResponse = { transcript: TranscriptUser | null };

const TYPE_LABEL: Record<AssessmentType, string> = {
  QUIZ: "Quiz",
  EXAM: "Exam",
  ASSIGNMENT: "Assignment",
  PROJECT: "Project",
};

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submitted",
  GRADED: "Graded",
  IN_REVIEW: "In Review",
};

function gradeLabel(score: number, total: number) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  if (pct >= 90) return "A";
  if (pct >= 75) return "B";
  if (pct >= 60) return "C";
  if (pct >= 40) return "D";
  return "F";
}

function gradeColor(score: number, total: number) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  if (pct >= 75) return "text-emerald-700 dark:text-emerald-400";
  if (pct >= 60) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function TranscriptPage() {
  const searchParams = useSearchParams();
  const wardId = searchParams.get("wardId");

  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptUser | null>(null);

  useEffect(() => {
    let active = true;
    const url = wardId ? `/api/transcript?wardId=${wardId}` : "/api/transcript";

    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<TranscriptResponse>) : Promise.reject()))
      .then((data) => { if (active) setTranscript(data.transcript); })
      .catch(() => { if (active) setTranscript(null); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [wardId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="kat-card space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="kat-card">
        <p className="text-sm text-slate-600">Transcript not available.</p>
      </div>
    );
  }

  const totalAssessments = transcript.enrollments.flatMap((e) => e.program.assessments).length;
  const allSubmissions = transcript.enrollments
    .flatMap((e) => e.program.assessments)
    .flatMap((a) => a.submissions.map((s) => ({ ...s, passScore: a.passScore, totalPoints: a.totalPoints })));
  const gradedSubmissions = allSubmissions.filter((s) => s.gradedAt !== null);
  const passedCount = gradedSubmissions.filter((s) => s.totalScore >= s.passScore).length;
  const avgScore =
    gradedSubmissions.length === 0
      ? null
      : Math.round(
          (gradedSubmissions.reduce((sum, s) => sum + (s.totalScore / s.totalPoints) * 100, 0) /
            gradedSubmissions.length) *
            10,
        ) / 10;

  return (
    <div className="space-y-4 max-[360px]:space-y-3">
      {/* Header */}
      <div className="kat-card print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              KAT Learning — Academic Transcript
            </p>
            <h2 className="mt-1 [font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900 dark:text-slate-100">
              {transcript.firstName} {transcript.lastName}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{transcript.email}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{transcript.role}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Member since {formatDate(transcript.createdAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="print:hidden gap-2"
            onClick={handlePrint}
          >
            <Printer className="size-4" />
            Print / Save as PDF
          </Button>
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Programs", value: transcript.enrollments.length },
            { label: "Assessments", value: totalAssessments },
            { label: "Passed", value: `${passedCount} / ${gradedSubmissions.length}` },
            { label: "Avg Score", value: avgScore !== null ? `${avgScore}%` : "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-enrollment records */}
      {transcript.enrollments.length === 0 ? (
        <div className="kat-card">
          <p className="text-sm text-slate-600 dark:text-slate-400">No enrollments on record.</p>
        </div>
      ) : (
        transcript.enrollments.map((enrollment) => {
          const assessments = enrollment.program.assessments;
          const submitted = assessments.filter((a) => a.submissions.length > 0).length;

          return (
            <div key={enrollment.id} className="kat-card print:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {enrollment.program.name}
                  </h3>
                  {enrollment.cohort && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Cohort: {enrollment.cohort.name}
                      {enrollment.cohort.startsAt &&
                        ` · ${formatDate(enrollment.cohort.startsAt)} – ${formatDate(enrollment.cohort.endsAt)}`}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      {enrollment.status}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      Enrolled {formatDate(enrollment.enrolledAt)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      {submitted}/{assessments.length} submitted
                    </span>
                  </div>
                </div>
              </div>

              {assessments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No published assessments yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <th className="pb-2">Assessment</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Score</th>
                        <th className="pb-2">Grade</th>
                        <th className="pb-2">Pass?</th>
                        <th className="pb-2">Submitted</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {assessments.map((assessment) => {
                        const sub = assessment.submissions[0];
                        if (!sub) {
                          return (
                            <tr key={assessment.id}>
                              <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">{assessment.title}</td>
                              <td className="py-2.5 text-slate-500 dark:text-slate-400">{TYPE_LABEL[assessment.type]}</td>
                              <td className="py-2.5 text-slate-400 dark:text-slate-500" colSpan={5}>
                                Not submitted
                              </td>
                            </tr>
                          );
                        }
                        const passed = sub.totalScore >= assessment.passScore;
                        return (
                          <tr key={assessment.id}>
                            <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">{assessment.title}</td>
                            <td className="py-2.5 text-slate-500 dark:text-slate-400">{TYPE_LABEL[assessment.type]}</td>
                            <td className="py-2.5">
                              <span className={cn("font-semibold", gradeColor(sub.totalScore, assessment.totalPoints))}>
                                {sub.totalScore}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">/{assessment.totalPoints}</span>
                            </td>
                            <td className="py-2.5">
                              <span className={cn("font-bold", gradeColor(sub.totalScore, assessment.totalPoints))}>
                                {gradeLabel(sub.totalScore, assessment.totalPoints)}
                              </span>
                            </td>
                            <td className="py-2.5">
                              {sub.gradedAt ? (
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                                    passed
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
                                  )}
                                >
                                  {passed ? "Pass" : "Fail"}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-slate-500">Pending</span>
                              )}
                            </td>
                            <td className="py-2.5 text-slate-600 dark:text-slate-400">{formatDate(sub.submittedAt)}</td>
                            <td className="py-2.5">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {STATUS_LABEL[sub.status] ?? sub.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="kat-card print:block hidden text-center text-xs text-slate-500 dark:text-slate-400">
        Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · KAT Learning · kat.africa
      </div>
    </div>
  );
}
