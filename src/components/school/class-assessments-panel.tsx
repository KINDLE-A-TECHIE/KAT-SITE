"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, FileCheck2, Loader2, Lock, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Item = {
  id: string;
  title: string;
  type: string;
  totalPoints: number;
  moduleTitle: string | null;
  termNumber: number | null;
  licensed: boolean;
  scheduled: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

// A stored ISO instant -> the value a <input type="datetime-local"> expects (local wall-clock, no zone).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWindow(opensAt: string | null, closesAt: string | null): string {
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (opensAt && closesAt) return `${fmt(opensAt)} to ${fmt(closesAt)}`;
  if (opensAt) return `Opens ${fmt(opensAt)}`;
  if (closesAt) return `Closes ${fmt(closesAt)}`;
  return "Open anytime";
}

/**
 * The teacher's tests and exams for a class. KAT authors every assessment; the teacher only decides
 * when their class sits one, so this schedules a KAT assessment (optionally with an open/close window)
 * and never edits its content. Locked-term assessments are shown but cannot be scheduled.
 */
export function ClassAssessmentsPanel({ classId }: { classId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    // no-store: after scheduling we reload immediately, and a cached GET would show the old state.
    const res = await fetch(`/api/school/teach/assessments?classId=${encodeURIComponent(classId)}`, { cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load assessments.");
      return;
    }
    setItems(payload.assessments ?? []);
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (item: Item) => {
    setEditing(item.id);
    setOpens(toLocalInput(item.opensAt));
    setCloses(toLocalInput(item.closesAt));
  };

  const schedule = async (item: Item) => {
    setBusy(item.id);
    const res = await fetch("/api/school/teach/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        assessmentId: item.id,
        scheduled: true,
        opensAt: opens ? new Date(opens).toISOString() : null,
        closesAt: closes ? new Date(closes).toISOString() : null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not schedule the assessment.");
      return;
    }
    toast.success("Assessment scheduled.");
    setEditing(null);
    await load();
  };

  const unschedule = async (item: Item) => {
    setBusy(item.id);
    const res = await fetch("/api/school/teach/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, assessmentId: item.id, scheduled: false }),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error ?? "Could not update the assessment.");
      return;
    }
    toast.success("Assessment un-scheduled.");
    await load();
  };

  if (loading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (items.length === 0) return null;

  const scheduledCount = items.filter((i) => i.scheduled).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tests and exams</CardTitle>
        <CardDescription>
          KAT sets the questions. You choose when your class sits each one. {scheduledCount} of{" "}
          {items.length} scheduled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {items.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-stone-900 dark:text-stone-100">
                    {item.title}
                    <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">{item.type}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    {item.moduleTitle ?? "Unit"}
                    {item.termNumber ? ` · Term ${item.termNumber}` : ""} · {item.totalPoints} marks
                  </p>
                  {item.scheduled ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CalendarClock className="size-3.5" />
                      {formatWindow(item.opensAt, item.closesAt)}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  {!item.licensed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                      <Lock className="size-3.5" /> Term not licensed
                    </span>
                  ) : item.scheduled ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/teach/${classId}/grade/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/40"
                      >
                        <PenLine className="size-3.5" /> Mark
                      </Link>
                      <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => openEditor(item)}>
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === item.id}
                        onClick={() => void unschedule(item)}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                      >
                        {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : "Un-schedule"}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="gap-1.5" disabled={busy === item.id} onClick={() => openEditor(item)}>
                      <FileCheck2 className="size-3.5" /> Schedule
                    </Button>
                  )}
                </div>
              </div>

              {editing === item.id ? (
                <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-800/40">
                  <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">
                    Set an open/close window, or leave both blank to let the class sit it anytime while the
                    term is licensed.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <label className="text-xs text-stone-600 dark:text-stone-300">
                      Opens
                      <input
                        type="datetime-local"
                        value={opens}
                        onChange={(e) => setOpens(e.target.value)}
                        className="mt-0.5 block rounded-md border border-stone-200 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
                      />
                    </label>
                    <label className="text-xs text-stone-600 dark:text-stone-300">
                      Closes
                      <input
                        type="datetime-local"
                        value={closes}
                        onChange={(e) => setCloses(e.target.value)}
                        className="mt-0.5 block rounded-md border border-stone-200 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="gap-1.5" disabled={busy === item.id} onClick={() => void schedule(item)}>
                      {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      {item.scheduled ? "Save window" : "Schedule"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
