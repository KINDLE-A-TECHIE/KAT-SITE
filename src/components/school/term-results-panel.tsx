"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TermResult = { percent: number; grade: string; hasResult: boolean };
type ModuleInfo = { id: string; title: string; termNumber: number };
type Pupil = { userId: string; firstName: string; lastName: string; results: Record<string, TermResult> };

/**
 * The class's term results: every pupil's weighted CA + Exam grade per term-module, and a link to each
 * pupil's printable report card. KAT auto-marks quizzes/code; the teacher marks theory/practical; this
 * is the combined result.
 */
export function TermResultsPanel({ classId }: { classId: string }) {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [pupils, setPupils] = useState<Pupil[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/school/teach/term-results?classId=${encodeURIComponent(classId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not load term results.");
        setPupils([]);
        return;
      }
      setModules(data.modules ?? []);
      setPupils(data.pupils ?? []);
    })();
  }, [classId]);

  if (!pupils) return <Skeleton className="h-48 w-full rounded-lg" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Term results</CardTitle>
        <CardDescription>Weighted continuous assessment and exam per term. Open a pupil&apos;s report card to print it.</CardDescription>
      </CardHeader>
      <CardContent>
        {pupils.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No pupils in this class yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left dark:border-stone-800">
                  <th className="py-2 pr-3 font-semibold">Pupil</th>
                  {modules.map((m) => (
                    <th key={m.id} className="px-3 py-2 text-center font-semibold" title={m.title}>Term {m.termNumber}</th>
                  ))}
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {pupils.map((p) => (
                  <tr key={p.userId} className="border-b border-stone-100 dark:border-stone-800/60">
                    <td className="py-2 pr-3 font-medium text-stone-900 dark:text-stone-100">
                      {p.firstName} {p.lastName}
                    </td>
                    {modules.map((m) => {
                      const r = p.results[m.id];
                      return (
                        <td key={m.id} className="px-3 py-2 text-center tabular-nums">
                          {r?.hasResult ? (
                            <span className="font-medium text-stone-800 dark:text-stone-200">
                              {r.grade} <span className="text-stone-400">({r.percent}%)</span>
                            </span>
                          ) : (
                            <span className="text-stone-300 dark:text-stone-600">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 pl-3 text-right">
                      <Link
                        href={`/teach/${classId}/report-card/${p.userId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
                      >
                        <FileText className="size-3.5" /> Report card
                      </Link>
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
}
