"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Module = { id: string; title: string; termNumber: number };
type GateValue = "NOT_STARTED" | "IN_PROGRESS" | "PASSED";
type Pupil = {
  userId: string;
  name: string;
  assessmentGate: GateValue;
  projectGate: GateValue;
  instructorGate: GateValue;
  allGatesPassed: boolean;
};

const GATE_DOT: Record<GateValue, string> = {
  PASSED: "bg-emerald-500",
  IN_PROGRESS: "bg-amber-500",
  NOT_STARTED: "bg-stone-300 dark:bg-stone-600",
};

function Gate({ label, status }: { label: string; status: GateValue }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
      <span className={`size-2 rounded-full ${GATE_DOT[status]}`} aria-hidden />
      {label}
    </span>
  );
}

/**
 * Combined 3-gate mastery for one CODING unit, plus the teacher sign-off (the instructor gate).
 * The assessment gate comes from graded results and the project gate from an approved team; the
 * teacher signs off the third here. REPORT-ONLY: mastery is a signal for the report card and
 * parents, it never blocks a licensed pupil from the next unit.
 */
export function MasterySignoffPanel({ classId, modules }: { classId: string; modules: Module[] }) {
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    const res = await fetch(
      `/api/school/teach/module-signoff?classId=${encodeURIComponent(classId)}&moduleId=${encodeURIComponent(moduleId)}`,
      { cache: "no-store" },
    );
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load mastery.");
      return;
    }
    setPupils(payload.pupils ?? []);
  }, [classId, moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const signOff = async (pupil: Pupil, passed: boolean) => {
    setBusy(pupil.userId);
    const res = await fetch("/api/school/teach/module-signoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, moduleId, userId: pupil.userId, passed }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not update the sign-off.");
      return;
    }
    toast.success(passed ? "Signed off." : "Sign-off withdrawn.");
    await load();
  };

  if (modules.length === 0) return null;

  const mastered = pupils.filter((p) => p.allGatesPassed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-orange-600" /> Mastery and sign-off
            </CardTitle>
            <CardDescription>
              Three gates per pupil: assessment (auto), project (approved team), and your sign-off.
              A pupil masters the unit when all three pass. This is a record, it never locks a lesson.
            </CardDescription>
          </div>
          {modules.length > 1 ? (
            <label className="text-xs text-stone-600 dark:text-stone-300">
              Unit
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="mt-0.5 block rounded-md border border-stone-200 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    Term {m.termNumber}: {m.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : pupils.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No pupils on this roster yet.</p>
        ) : (
          <>
            <p className="mb-3 text-xs font-medium text-stone-500 dark:text-stone-400">
              {mastered} of {pupils.length} mastered this unit.
            </p>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {pupils.map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-stone-900 dark:text-stone-100">
                      {p.name}
                      {p.allGatesPassed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> Mastered
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <Gate label="Assessment" status={p.assessmentGate} />
                      <Gate label="Project" status={p.projectGate} />
                      <Gate label="Teacher" status={p.instructorGate} />
                    </div>
                  </div>
                  <div className="shrink-0">
                    {p.instructorGate === "PASSED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === p.userId}
                        onClick={() => void signOff(p, false)}
                        className="text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                      >
                        {busy === p.userId ? <Loader2 className="size-3.5 animate-spin" /> : "Withdraw"}
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-1.5" disabled={busy === p.userId} onClick={() => void signOff(p, true)}>
                        {busy === p.userId ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                        Sign off
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
