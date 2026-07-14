"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Code2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Unit = {
  moduleId: string;
  order: number;
  label: string;
  strand: "CODING" | "DIGLIT";
  delivered: boolean;
  deliveredBy: string | null;
  basis: "FIRST_HAND" | "SUCCESSOR" | null;
  taughtByName: string | null;
  engagementPct: number;
};

type TeacherTerm = { teacherName: string; from: string; to: string | null };

/**
 * The teacher's attestation that they delivered each scheme unit.
 *
 * This is the only record of TEACHING in the system, and it appears on the compliance
 * report the school may show a regulator, so the UI says plainly whose claim it is.
 */
export function UnitDeliveryPanel({ classId }: { classId: string }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [teachers, setTeachers] = useState<TeacherTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<Unit | null>(null);

  const load = useCallback(async () => {
    // The report API already computes coverage; reuse it rather than a second endpoint.
    const res = await fetch(`/api/school/reports?classId=${encodeURIComponent(classId)}`);
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load units.");
      return;
    }
    setUnits(payload.classes?.[0]?.coverage?.units ?? []);
    setTeachers(payload.classes?.[0]?.coverage?.teachers ?? []);
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The predecessor, if this class has changed hands. Only then is a SUCCESSOR claim possible,
  // and only then do we ask, so the common case stays a single click.
  const predecessor = teachers.find((t) => t.to !== null)?.teacherName ?? null;

  const mark = async (unit: Unit, basis: "FIRST_HAND" | "SUCCESSOR") => {
    setBusy(unit.moduleId);
    setAsking(null);
    const res = await fetch("/api/school/teach/delivery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        moduleId: unit.moduleId,
        delivered: !unit.delivered, ...(unit.delivered ? {} : { basis }),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not update.");
      return;
    }
    toast.success(unit.delivered ? "Marked as not delivered." : "Marked as delivered.");
    await load();
  };

  const toggle = (unit: Unit) => {
    // Un-marking, or a class that never changed hands: nothing to disambiguate.
    if (unit.delivered || !predecessor) return void mark(unit, "FIRST_HAND");
    setAsking(unit);
  };

  if (loading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (units.length === 0) return null;

  const delivered = units.filter((u) => u.delivered).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scheme delivery</CardTitle>
        <CardDescription>
          Mark each unit you have taught. <strong>Your name is recorded against the claim</strong>.
          it appears on your school&apos;s NERDC coverage report. {delivered} of {units.length}{" "}
          delivered.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {units.map((u) => (
            <li key={u.moduleId} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  {u.order}. {u.label}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <Badge variant="secondary" className="gap-1">
                    {u.strand === "CODING" ? <Code2 className="size-3" /> : <FileText className="size-3" />}
                    {u.strand === "CODING" ? "Coding" : "Digital literacy"}
                  </Badge>
                  <span>{u.engagementPct}% student engagement</span>
                  {u.deliveredBy ? (
                    <span>
                      ·{" "}
                      {u.basis === "SUCCESSOR"
                        ? `recorded by ${u.deliveredBy}, taught by ${u.taughtByName ?? "a predecessor"}`
                        : `attested by ${u.deliveredBy}`}
                    </span>
                  ) : null}
                </p>
              </div>

              <Button
                size="sm"
                variant={u.delivered ? "default" : "outline"}
                disabled={busy === u.moduleId}
                onClick={() => toggle(u)}
                className={u.delivered ? "gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" : "gap-1.5"}
              >
                {busy === u.moduleId ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : u.delivered ? (
                  <Check className="size-3.5" />
                ) : null}
                {u.delivered ? "Delivered" : "Mark delivered"}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>

      {/*
        Only shown on a class that has changed hands. A teacher who inherits a class faces units
        she did not teach, and the two obvious answers are both dishonest: sign her predecessor's
        name, or let real teaching read as "not delivered". So we ask which claim she is actually
        making, and she signs her own name to it either way.
      */}
      <Dialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What are you recording?</DialogTitle>
            <DialogDescription>
              This class changed hands during the term, so your name will be recorded against one of
              two different claims. Choose the one that is true.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-lg bg-stone-50 p-3 text-sm font-medium text-stone-800 dark:bg-stone-800/50 dark:text-stone-100">
            {asking?.order}. {asking?.label}
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => asking && mark(asking, "FIRST_HAND")}
              className="w-full rounded-xl border border-stone-200 p-3 text-left transition hover:border-orange-400 dark:border-stone-700"
            >
              <p className="font-medium text-stone-900 dark:text-stone-100">I taught this unit</p>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                A first-hand attestation, in your name.
              </p>
            </button>

            <button
              type="button"
              onClick={() => asking && mark(asking, "SUCCESSOR")}
              className="w-full rounded-xl border border-stone-200 p-3 text-left transition hover:border-orange-400 dark:border-stone-700"
            >
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {predecessor} taught this before I took the class
              </p>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                Recorded by you, on their behalf. The report shows this as second-hand: weaker
                evidence than a first-hand attestation, and never counted as one.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
