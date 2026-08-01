"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Item = {
  id: string;
  title: string;
  type: string;
  moduleTitle: string | null;
  opensAt: string | null;
  closesAt: string | null;
  submitted: boolean;
};

function windowLabel(opensAt: string | null, closesAt: string | null): string {
  const f = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (closesAt) return `Closes ${f(closesAt)}`;
  if (opensAt) return `Opened ${f(opensAt)}`;
  return "Open now";
}

/** A pupil's list of tests and exams that are open to them right now. */
export function AssessmentsList() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/school/learn/assessments", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not load your tests.");
        setItems([]);
        return;
      }
      setItems(data.assessments ?? []);
    })();
  }, []);

  if (!items) return <Skeleton className="h-48 w-full rounded-lg" />;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Assessment</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          Tests &amp; exams
        </h1>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardCheck className="size-8 text-stone-300 dark:text-stone-600" />
            <p className="max-w-sm text-sm text-stone-500 dark:text-stone-400">
              No tests are set for you right now. Your teacher will schedule them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-stone-900 dark:text-stone-100">
                  {item.title}
                  <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">{item.type}</Badge>
                </p>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {item.moduleTitle ?? "Unit"} · {windowLabel(item.opensAt, item.closesAt)}
                </p>
              </div>
              {item.submitted ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Submitted
                </span>
              ) : (
                <Link
                  href={`/learn/assessments/${item.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-kat-clay px-4 py-2 text-sm font-semibold text-white transition hover:bg-kat-clay-deep"
                >
                  Start <ArrowRight className="size-4" />
                </Link>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
