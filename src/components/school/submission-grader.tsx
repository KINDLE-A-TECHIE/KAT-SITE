"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Criterion = { label: string; description: string | null; maxPoints: number };
type ManualAnswer = {
  answerId: string;
  questionId: string;
  prompt: string;
  type: "OPEN_ENDED" | "RUBRIC";
  maxPoints: number;
  responseText: string | null;
  manualScore: number;
  rubric: Criterion[];
};
type Submission = {
  submissionId: string;
  userId: string;
  pupilName: string;
  status: string;
  autoScore: number;
  totalScore: number;
  manualAnswers: ManualAnswer[];
};

/**
 * A teacher marks the human-graded answers (theory + observed practical rubric) of their class's
 * submissions to one assessment. KAT auto-marked the objective and CODE questions; this finalizes the
 * rest. Rubric criteria are scored individually and summed into the answer's mark.
 */
export function SubmissionGrader({ classId, assessmentId }: { classId: string; assessmentId: string }) {
  const [title, setTitle] = useState("");
  const [subs, setSubs] = useState<Submission[] | null>(null);
  // scores[answerId] = the mark for an OPEN_ENDED answer, or the per-criterion marks for a RUBRIC answer.
  const [open, setOpen] = useState<Record<string, number>>({});
  const [rubric, setRubric] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/school/teach/submissions?classId=${encodeURIComponent(classId)}&assessmentId=${encodeURIComponent(assessmentId)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error ?? "Could not load submissions.");
      setSubs([]);
      return;
    }
    setTitle(data.title ?? "");
    setSubs(data.submissions ?? []);
    const o: Record<string, number> = {};
    const r: Record<string, number[]> = {};
    for (const s of data.submissions ?? []) {
      for (const a of s.manualAnswers) {
        if (a.type === "OPEN_ENDED") o[a.answerId] = a.manualScore ?? 0;
        else r[a.answerId] = a.rubric.map(() => 0);
      }
    }
    setOpen(o);
    setRubric(r);
  }, [classId, assessmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (s: Submission) => {
    setSaving(s.submissionId);
    const grades = s.manualAnswers.map((a) => ({
      answerId: a.answerId,
      score: a.type === "OPEN_ENDED" ? (open[a.answerId] ?? 0) : (rubric[a.answerId] ?? []).reduce((x, y) => x + (y || 0), 0),
    }));
    const res = await fetch("/api/school/teach/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: s.submissionId, grades }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Could not save the grades.");
      return;
    }
    toast.success(`Marked. Total ${data.submission?.totalScore}.`);
    await load();
  };

  if (!subs) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/teach/${classId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400">
          <ArrowLeft className="size-3.5" /> Back to class
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">Marking: {title}</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          The quiz and coding parts are marked automatically. Mark the written and practical answers below.
        </p>
      </div>

      {subs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-stone-500 dark:text-stone-400">No submissions yet.</CardContent></Card>
      ) : (
        subs.map((s) => (
          <Card key={s.submissionId}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">{s.pupilName}</CardTitle>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={s.status === "GRADED" ? "default" : "secondary"} className={s.status === "GRADED" ? "bg-emerald-600" : ""}>
                  {s.status === "GRADED" ? "Marked" : "To mark"}
                </Badge>
                <span className="text-stone-500 dark:text-stone-400">Auto {s.autoScore} · Total {s.totalScore}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {s.manualAnswers.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-stone-400">Nothing to mark by hand, this one is fully auto-marked.</p>
              ) : (
                s.manualAnswers.map((a) => (
                  <div key={a.answerId} className="rounded-lg border border-stone-100 p-3 dark:border-stone-800">
                    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{a.prompt}</p>

                    {a.type === "OPEN_ENDED" ? (
                      <>
                        <p className="mt-2 whitespace-pre-wrap rounded bg-stone-50 p-2.5 text-sm text-stone-700 dark:bg-stone-800/40 dark:text-stone-300">
                          {a.responseText || <span className="text-stone-400">No answer written.</span>}
                        </p>
                        <label className="mt-2 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                          Mark:
                          <input
                            type="number"
                            min={0}
                            max={a.maxPoints}
                            value={open[a.answerId] ?? 0}
                            onChange={(e) => setOpen((p) => ({ ...p, [a.answerId]: Number(e.target.value) }))}
                            className="w-20 rounded-md border border-stone-200 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
                          />
                          <span className="text-stone-400">/ {a.maxPoints}</span>
                        </label>
                      </>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-xs text-stone-500 dark:text-stone-400">Score each criterion as you observe the pupil or their build:</p>
                        {a.rubric.map((c, k) => (
                          <label key={k} className="flex items-center justify-between gap-2 text-sm text-stone-700 dark:text-stone-300">
                            <span>{c.label}</span>
                            <span className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={c.maxPoints}
                                value={rubric[a.answerId]?.[k] ?? 0}
                                onChange={(e) =>
                                  setRubric((p) => {
                                    const arr = [...(p[a.answerId] ?? a.rubric.map(() => 0))];
                                    arr[k] = Number(e.target.value);
                                    return { ...p, [a.answerId]: arr };
                                  })
                                }
                                className="w-16 rounded-md border border-stone-200 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
                              />
                              <span className="text-stone-400">/ {c.maxPoints}</span>
                            </span>
                          </label>
                        ))}
                        <p className="text-right text-xs font-medium text-stone-500 dark:text-stone-400">
                          Subtotal {(rubric[a.answerId] ?? []).reduce((x, y) => x + (y || 0), 0)} / {a.maxPoints}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}

              {s.manualAnswers.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void save(s)}
                  disabled={saving === s.submissionId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-kat-clay px-4 py-2 text-sm font-semibold text-white transition hover:bg-kat-clay-deep disabled:opacity-70"
                >
                  {saving === s.submissionId ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {s.status === "GRADED" ? "Update marks" : "Save marks"}
                </button>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
