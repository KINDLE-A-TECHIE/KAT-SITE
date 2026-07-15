"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BookOpen, Check, Circle, Code2, FileText, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type Gates = {
  assessmentGate: string;
  projectGate: string;
  instructorGate: string;
  allGatesPassed: boolean;
} | null;

type LearnModule = {
  id: string;
  title: string;
  description: string | null;
  strand: "CODING" | "DIGLIT";
  gates: Gates;
  lessons: Array<{ id: string; title: string; completed: boolean }>;
};

type LearnResponse = {
  licensed: boolean;
  reason?: string;
  class: { id: string; name: string; term: string } | null;
  program?: { id: string; name: string } | null;
  modules: LearnModule[];
};

export function LearnPanel() {
  const [data, setData] = useState<LearnResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/school/learn");
      const payload = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        toast.error(payload?.error ?? "Could not load your lessons.");
        setLoading(false);
        return;
      }
      setData(payload as LearnResponse);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!data) return null;

  // Licence gate. The same rule is enforced in the curriculum APIs, so this is a
  // clear explanation rather than the actual lock.
  if (!data.licensed) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Lock className="size-8 text-stone-300 dark:text-stone-600" />
          <p className="max-w-sm text-sm text-stone-500 dark:text-stone-400">{data.reason}</p>
        </CardContent>
      </Card>
    );
  }

  const totalLessons = data.modules.reduce((n, m) => n + m.lessons.length, 0);
  const doneLessons = data.modules.reduce(
    (n, m) => n + m.lessons.filter((l) => l.completed).length,
    0,
  );
  const pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Learning</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          {data.program?.name ?? "Your course"}
        </h1>
        {data.class ? (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {data.class.name} · Term {data.class.term}
          </p>
        ) : null}
      </header>

      {totalLessons > 0 ? (
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Progress value={pct} className="h-2 flex-1" />
            <span className="shrink-0 text-sm text-stone-500 dark:text-stone-400">
              {doneLessons}/{totalLessons} lessons
            </span>
          </CardContent>
        </Card>
      ) : null}

      {data.modules.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Your teacher hasn&apos;t published any units for this course yet. They&apos;ll appear
              here as soon as they do.
            </p>
          </CardContent>
        </Card>
      ) : (
        data.modules.map((m) => {
          const isCoding = m.strand === "CODING";
          return (
            <Card key={m.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <CardDescription>
                    {m.description ??
                      (isCoding
                        ? "Build and run code in the platform."
                        : "Slides and worksheets. Read through and mark complete.")}
                  </CardDescription>
                </div>

                {/* Strand badge: the whole point of the CODING/DIGLIT split. */}
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

              <CardContent className="space-y-3">
                {/* Gates apply to CODING units only. */}
                {isCoding && m.gates ? (
                  <div className="flex flex-wrap gap-1.5">
                    <GateChip label="Quiz" status={m.gates.assessmentGate} />
                    <GateChip label="Project" status={m.gates.projectGate} />
                    <GateChip label="Teacher review" status={m.gates.instructorGate} />
                  </div>
                ) : null}

                {m.lessons.length === 0 ? (
                  <p className="text-sm text-stone-400">No lessons in this unit yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/learn/lessons/${l.id}`}
                          className="flex items-center gap-3 py-2.5 text-sm transition hover:text-orange-700 dark:hover:text-orange-400"
                        >
                          {l.completed ? (
                            <Check className="size-4 shrink-0 text-emerald-600" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-stone-300 dark:text-stone-600" />
                          )}
                          <span
                            className={
                              l.completed
                                ? "text-stone-500 line-through dark:text-stone-400"
                                : "text-stone-800 dark:text-stone-200"
                            }
                          >
                            {l.title}
                          </span>
                          <BookOpen className="ml-auto size-3.5 shrink-0 text-stone-300 dark:text-stone-600" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function GateChip({ label, status }: { label: string; status: string }) {
  const passed = status === "PASSED";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        passed
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
      }`}
    >
      {label}
      {passed ? " ✓" : ""}
    </span>
  );
}
