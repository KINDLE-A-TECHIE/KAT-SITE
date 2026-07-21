"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/stat-ledger";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NERDC_LABELS: Record<string, string> = {
  PRIMARY_1_3: "Primary 1–3",
  PRIMARY_4_6: "Primary 4–6",
  JSS: "JSS 1–3",
  SSS: "SSS 1–3",
};

type Course = { id: string; name: string };

type TeachClass = {
  id: string;
  name: string;
  nerdcLevel: string;
  sessionLabel: string;
  programId: string | null;
  program: Course | null;
  _count: { enrollments: number };
  /** False when this class's TERM has no active licence. */
  licensed: boolean;
  licenseReason: string | null;
};

export function TeachClassesPanel() {
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [coursesByLevel, setCoursesByLevel] = useState<Record<string, Course[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/school/teach/classes");
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      toast.error(payload?.error ?? "Could not load your classes.");
      return;
    }
    setClasses(payload.classes ?? []);
    setCoursesByLevel(payload.coursesByLevel ?? {});
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignCourse = async (classId: string, programId: string) => {
    setBusy(classId);
    const res = await fetch("/api/school/teach/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: classId, programId }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not assign the course.");
      return;
    }
    toast.success("Course assigned.");
    await load();
  };

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (classes.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white py-10 text-center dark:border-stone-800 dark:bg-stone-900">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          You have no classes assigned yet. Your school administrator assigns classes to teachers.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      {classes.map((c) => {
        const courses = coursesByLevel[c.nerdcLevel] ?? [];
        const locked = c._count.enrollments > 0;

        return (
          <div
            key={c.id}
            className="border-b border-stone-100 p-4 last:border-b-0 dark:border-stone-800 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{c.name}</p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400">
                  {NERDC_LABELS[c.nerdcLevel] ?? c.nerdcLevel} · {c.sessionLabel} ·{" "}
                  {c._count.enrollments} student{c._count.enrollments === 1 ? "" : "s"}
                </p>
              </div>
              {/* An unlicensed term is a dead end, don't offer a link that will 403. */}
              {c.licensed ? (
                <Link
                  href={`/teach/${c.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
                >
                  Roster &amp; progress
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : (
                <StatusDot tone="clay" label="Licence inactive" />
              )}
            </div>

            {/* The licence gate: the same rule is enforced in the API, so this is the
                explanation, not the lock. */}
            {!c.licensed ? (
              <p className="mt-3 border-l-2 border-stone-200 pl-3 text-sm leading-relaxed text-stone-500 dark:border-stone-800 dark:text-stone-400">
                {c.licenseReason}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
                Course
              </span>

              {locked ? (
                <>
                  <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                    {c.program?.name ?? "Not assigned"}
                  </span>
                  <span className="text-xs text-stone-400">
                    Locked. Students are enrolled, so the course can no longer change.
                  </span>
                </>
              ) : (
                <Select
                  value={c.programId ?? ""}
                  onValueChange={(v) => assignCourse(c.id, v)}
                  disabled={busy === c.id || courses.length === 0 || !c.licensed}
                >
                  <SelectTrigger className="h-9 w-full max-w-sm">
                    <SelectValue
                      placeholder={courses.length === 0 ? "No course for this level" : "Choose a course"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
