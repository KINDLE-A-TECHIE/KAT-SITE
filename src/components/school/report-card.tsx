"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type TermResult = { ca: { earned: number; total: number }; exam: { earned: number; total: number }; percent: number; grade: string; hasResult: boolean };
type ModuleInfo = { id: string; title: string; termNumber: number };
type Pupil = { userId: string; firstName: string; lastName: string; results: Record<string, TermResult> };
type Data = { class: { name: string; sessionLabel: string }; modules: ModuleInfo[]; pupils: Pupil[] };

/**
 * A printable end-of-term report card for one pupil: continuous assessment, exam, and the weighted total
 * grade per term-module, on A4. Prints with just the card (toolbar and shell hidden).
 */
export function ReportCard({ classId, userId }: { classId: string; userId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/school/teach/term-results?classId=${encodeURIComponent(classId)}&userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "Could not load the report card.");
        return;
      }
      setData(payload);
    })();
  }, [classId, userId]);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-stone-200 py-16 text-center dark:border-stone-800">
        <p className="font-medium text-stone-600 dark:text-stone-300">{error}</p>
        <Link href={`/teach/${classId}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-kat-clay hover:underline">
          <ArrowLeft className="size-3.5" /> Back to class
        </Link>
      </div>
    );
  }
  if (!data) return <Skeleton className="h-96 w-full rounded-lg" />;

  const pupil = data.pupils[0];
  if (!pupil) {
    return <p className="text-sm text-stone-500 dark:text-stone-400">No results for this pupil.</p>;
  }

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 16mm 14mm; }
        @media print { html, body { background: #fff !important; } #rc-toolbar { display: none !important; } }
      `}</style>

      <div id="rc-toolbar" className="mb-4 flex items-center gap-2 print:hidden">
        <Link href={`/teach/${classId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300">
          <ArrowLeft className="size-3.5" /> Back to class
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-kat-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          <Printer className="size-4" /> Print / Save PDF
        </button>
      </div>

      <div className="mx-auto max-w-[210mm] rounded-lg border border-stone-200 bg-white p-8 text-stone-900 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-stone-300 pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400">Report card</p>
            <h1 className="mt-1 font-display text-xl font-bold">{pupil.firstName} {pupil.lastName}</h1>
            <p className="text-sm text-stone-500">{data.class.name} · {data.class.sessionLabel}</p>
          </div>
          <p className="text-right text-[10px] uppercase tracking-[0.14em] text-stone-400">
            kindle a techie
            <br />for schools
          </p>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-stone-200 text-left">
              <th className="py-2 pr-3 font-semibold">Term unit</th>
              <th className="px-3 py-2 text-center font-semibold">CA (40%)</th>
              <th className="px-3 py-2 text-center font-semibold">Exam (60%)</th>
              <th className="px-3 py-2 text-center font-semibold">Total</th>
              <th className="px-3 py-2 text-center font-semibold">Grade</th>
            </tr>
          </thead>
          <tbody>
            {data.modules.map((m) => {
              const r = pupil.results[m.id];
              const pct = (b: { earned: number; total: number }) => (b.total > 0 ? `${Math.round((b.earned / b.total) * 100)}%` : "-");
              return (
                <tr key={m.id} className="border-t border-stone-100">
                  <td className="py-2 pr-3">
                    <span className="font-medium">Term {m.termNumber}.</span> {m.title}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{r?.hasResult ? pct(r.ca) : "-"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{r?.hasResult ? pct(r.exam) : "-"}</td>
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">{r?.hasResult ? `${r.percent}%` : "-"}</td>
                  <td className="px-3 py-2 text-center font-bold">{r?.hasResult ? r.grade : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-4 text-[11px] text-stone-400">
          Continuous assessment (tests and class work) is weighted 40%, the terminal exam 60%. A dash means
          nothing has been marked for that term yet.
        </p>
      </div>
    </>
  );
}
