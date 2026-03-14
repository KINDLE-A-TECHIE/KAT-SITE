"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ────────────────────────────────────────────────────────────────────

type Grader = { id: string; firstName: string; lastName: string; role: string };

type AnswerFeedback = {
  id: string;
  feedback: string | null;
  manualScore: number | null;
  autoScore: number | null;
  isCorrect: boolean | null;
  question: { id: string; prompt: string; type: string };
  gradedBy: Grader | null;
};

type Submission = {
  id: string;
  status: string;
  totalScore: number | null;
  autoScore: number | null;
  manualScore: number | null;
  submittedAt: string;
  gradedAt: string | null;
  feedback: string | null;
  answers: AnswerFeedback[];
};

type Assessment = {
  id: string;
  title: string;
  type: string;
  passScore: number;
  totalPoints: number;
  dueDate: string | null;
  submissions: Submission[];
};

type Program = {
  id: string;
  name: string;
  assessments: Assessment[];
};

type Cohort = { id: string; name: string; startsAt: string | null; endsAt: string | null } | null;

type Enrollment = {
  id: string;
  status: string;
  enrolledAt: string;
  cohort: Cohort;
  program: Program;
};

type Child = { id: string; firstName: string; lastName: string; email: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

const ASSESSMENT_TYPE_STYLES: Record<string, string> = {
  QUIZ:       "bg-sky-100 text-sky-700",
  EXAM:       "bg-violet-100 text-violet-700",
  ASSIGNMENT: "bg-amber-100 text-amber-700",
  PROJECT:    "bg-emerald-100 text-emerald-700",
};

const ENROLLMENT_STATUS_STYLES: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  PAUSED:    "bg-amber-100 text-amber-700",
  DROPPED:   "bg-rose-100 text-rose-700",
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  FELLOW: "Fellow",
};

function SubmissionStatusBadge({ status }: { status: string }) {
  if (status === "GRADED") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Graded
      </span>
    );
  }
  if (status === "IN_REVIEW") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock className="h-3 w-3" /> In Review
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
      <Clock className="h-3 w-3" /> Submitted
    </span>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="kat-card flex items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Feedback section ──────────────────────────────────────────────────────────

function FeedbackSection({ submission, isParent }: { submission: Submission; isParent: boolean }) {
  const hasSubmissionFeedback = !!submission.feedback;
  const answerFeedbacks = submission.answers.filter((a) => a.feedback);

  if (!hasSubmissionFeedback && answerFeedbacks.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-semibold text-blue-700">
          {isParent ? "Instructor Comments & Feedback" : "Feedback"}
        </span>
      </div>

      {hasSubmissionFeedback && (
        <div>
          <p className="text-xs font-medium text-slate-600">Overall</p>
          <p className="mt-0.5 text-sm text-slate-700">{submission.feedback}</p>
        </div>
      )}

      {answerFeedbacks.map((a) => (
        <div key={a.id} className="border-t border-blue-100 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-xs font-medium text-slate-600 line-clamp-1">{a.question.prompt}</p>
            {a.gradedBy && (
              <span className="text-[10px] text-slate-400">
                {ROLE_LABEL[a.gradedBy.role] ?? a.gradedBy.role}: {a.gradedBy.firstName} {a.gradedBy.lastName}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-700">{a.feedback}</p>
          {a.manualScore !== null && (
            <p className="mt-0.5 text-xs text-slate-400">Score: {a.manualScore} pts</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Assessment row ────────────────────────────────────────────────────────────

function AssessmentRow({ assessment, isParent }: { assessment: Assessment; isParent: boolean }) {
  const submission = assessment.submissions[0] ?? null;
  const pct =
    submission?.totalScore !== null && submission?.totalScore !== undefined
      ? Math.round((submission.totalScore / assessment.totalPoints) * 100)
      : null;
  const passPct = Math.round((assessment.passScore / assessment.totalPoints) * 100);
  const passed = pct !== null && pct >= passPct;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Left: assessment info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{assessment.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSESSMENT_TYPE_STYLES[assessment.type] ?? "bg-slate-100 text-slate-600"}`}>
              {assessment.type}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Pass mark: {assessment.passScore}/{assessment.totalPoints} pts
            {assessment.dueDate && ` · Due ${new Date(assessment.dueDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`}
          </p>
        </div>

        {/* Right: score / status */}
        <div className="shrink-0">
          {!submission ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Not submitted</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <SubmissionStatusBadge status={submission.status} />
              {submission.status === "GRADED" && pct !== null && (
                <>
                  <span className={`[font-family:var(--font-space-grotesk)] text-base font-bold ${passed ? "text-emerald-600" : "text-rose-600"}`}>
                    {pct}%
                  </span>
                  <span className="text-xs text-slate-400">({submission.totalScore}/{assessment.totalPoints})</span>
                  {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                </>
              )}
              {submission.status !== "GRADED" && (
                <span className="text-xs text-slate-400">
                  Submitted {new Date(submission.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      {submission && <FeedbackSection submission={submission} isParent={isParent} />}
    </div>
  );
}

// ── Grades content ─────────────────────────────────────────────────────────────

function GradesContent({ enrollments, isParent }: { enrollments: Enrollment[]; isParent: boolean }) {
  if (enrollments.length === 0) {
    return (
      <div className="kat-card py-16 text-center">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No enrollments yet</p>
        <p className="mt-1 text-xs text-slate-400">
          {isParent ? "Your child is not enrolled in any programs yet." : "Enroll in a program to start tracking your grades and progress."}
        </p>
      </div>
    );
  }

  const allAssessments = enrollments.flatMap((e) => e.program.assessments);
  const submitted = allAssessments.filter((a) => a.submissions.length > 0);
  const graded = submitted.filter((a) => a.submissions[0]?.status === "GRADED");
  const passed = graded.filter((a) => {
    const sub = a.submissions[0];
    return sub?.totalScore !== undefined && sub.totalScore !== null && sub.totalScore >= a.passScore;
  });
  const avgPct =
    graded.length > 0
      ? Math.round(
          graded.reduce((acc, a) => {
            const sub = a.submissions[0]!;
            return acc + ((sub.totalScore ?? 0) / a.totalPoints) * 100;
          }, 0) / graded.length,
        )
      : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Programs Enrolled" value={enrollments.length} icon={BookOpen} color="bg-blue-100 text-blue-600" />
        <SummaryCard label="Assessments Taken" value={submitted.length} sub={`of ${allAssessments.length} total`} icon={FileText} color="bg-violet-100 text-violet-600" />
        <SummaryCard label="Passed" value={`${passed.length}/${graded.length}`} sub="graded assessments" icon={Award} color="bg-emerald-100 text-emerald-600" />
        <SummaryCard label="Average Score" value={avgPct !== null ? `${avgPct}%` : "—"} sub="across graded work" icon={TrendingUp} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Per-program */}
      {enrollments.map((enrollment, i) => {
        const { program, cohort } = enrollment;
        const progSubmitted = program.assessments.filter((a) => a.submissions.length > 0).length;
        const progTotal = program.assessments.length;

        return (
          <motion.div key={enrollment.id} className="kat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="[font-family:var(--font-space-grotesk)] text-base font-semibold text-slate-900">{program.name}</h3>
                {cohort && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {cohort.name}
                    {cohort.startsAt && ` · ${new Date(cohort.startsAt).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}`}
                    {cohort.endsAt && ` – ${new Date(cohort.endsAt).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ENROLLMENT_STATUS_STYLES[enrollment.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {enrollment.status}
                </span>
                <span className="text-xs text-slate-400">{progSubmitted}/{progTotal} submitted</span>
              </div>
            </div>

            {progTotal > 0 && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.round((progSubmitted / progTotal) * 100)}%` }} />
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {program.assessments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                  <p className="text-sm text-slate-400">No published assessments for this program yet.</p>
                </div>
              ) : (
                program.assessments.map((assessment) => (
                  <AssessmentRow key={assessment.id} assessment={assessment} isParent={isParent} />
                ))
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function GradesPanel({ children, isParent }: { children?: Child[]; isParent?: boolean }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  // For parents: initialize with first child
  useEffect(() => {
    if (isParent && children && children.length > 0 && !selectedChild) {
      setSelectedChild(children[0]!);
    }
  }, [isParent, children, selectedChild]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const url = isParent && selectedChild ? `/api/grades?wardId=${selectedChild.id}` : "/api/grades";
      const res = await fetch(url);
      if (res.ok) {
        const p = await res.json();
        setEnrollments(p.enrollments ?? []);
      }
      setLoading(false);
    };

    if (!isParent || selectedChild) {
      void load();
    }
  }, [isParent, selectedChild]);

  // ── Parent: child selector ──
  if (isParent) {
    const childList = children ?? [];

    return (
      <div className="space-y-4">
        {/* Child picker */}
        <div className="kat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Viewing grades for</p>
          {childList.length === 0 ? (
            <p className="text-sm text-slate-400">No linked children. Go to My Children to register or link a child.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {childList.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChild(child)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                    selectedChild?.id === child.id
                      ? "border-[#1E5FAF] bg-blue-50 text-[#1E5FAF] ring-1 ring-[#1E5FAF]/30"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  {child.firstName} {child.lastName}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedChild && (
          loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : (
            <GradesContent enrollments={enrollments} isParent={true} />
          )
        )}
      </div>
    );
  }

  // ── Learner view ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return <GradesContent enrollments={enrollments} isParent={false} />;
}
