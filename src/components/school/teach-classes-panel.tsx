"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  term: string;
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
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            You have no classes assigned yet. Your school administrator assigns classes to teachers.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {classes.map((c) => {
        const courses = coursesByLevel[c.nerdcLevel] ?? [];
        const locked = c._count.enrollments > 0;

        return (
          <Card key={c.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">{c.name}</CardTitle>
                <CardDescription>
                  {NERDC_LABELS[c.nerdcLevel] ?? c.nerdcLevel} · Term {c.term} ·{" "}
                  {c._count.enrollments} student{c._count.enrollments === 1 ? "" : "s"}
                </CardDescription>
              </div>
              {/* An unlicensed term is a dead end, don't offer a link that will 403. */}
              {c.licensed ? (
                <Link
                  href={`/teach/${c.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline"
                >
                  Roster &amp; progress
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : (
                <Badge variant="secondary" className="gap-1.5">
                  <Lock className="size-3" />
                  Licence inactive
                </Badge>
              )}
            </CardHeader>

            <CardContent>
              {/* The licence gate: the same rule is enforced in the API, so this is the
                  explanation, not the lock. */}
              {!c.licensed ? (
                <p className="mb-3 rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
                  {c.licenseReason}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
                  <BookOpen className="size-3.5 text-orange-600" />
                  Course
                </span>

                {locked ? (
                  <>
                    <Badge variant="secondary" className="gap-1.5">
                      <Lock className="size-3" />
                      {c.program?.name ?? "Not assigned"}
                    </Badge>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
