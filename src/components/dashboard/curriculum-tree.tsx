"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookOpen, CheckCircle2, ChevronDown, ChevronRight, GraduationCap,
  Lock, Plus, Settings, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type LessonSummary = { id: string; title: string; sortOrder: number; contents: { id: string }[] };
type Module = { id: string; title: string; description: string | null; sortOrder: number; lessons: LessonSummary[] };
type CurriculumVersion = { id: string; versionNumber: number; label: string; isActive: boolean; publishedAt: string | null; createdBy: { firstName: string; lastName: string } };
type CurriculumData = { versions: (CurriculumVersion & { modules: Module[] })[] } | null;
type GateStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "PASSED";
type ModuleGate = { assessmentGate: GateStatusValue; projectGate: GateStatusValue; instructorGate: GateStatusValue; allGatesPassed: boolean };
type ModuleGateMap = Record<string, ModuleGate>;

function GateIndicator({ label, status }: { label: string; status?: GateStatusValue }) {
  const passed = status === "PASSED";
  return (
    <span className={`flex items-center gap-1 text-xs ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"}`}>
      {passed
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-stone-300 dark:border-stone-600 inline-block" />
      }
      {label}
    </span>
  );
}

const CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

function AddInlineForm({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    await onSubmit(value.trim());
    setBusy(false);
  };

  return (
    <div className="flex gap-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); if (e.key === "Escape") onCancel(); }}
      />
      <Button size="sm" disabled={busy || !value.trim()} onClick={() => void submit()} className="h-8 shrink-0">
        {busy ? "…" : "Add"}
      </Button>
      <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

export function CurriculumTree({ programId, role }: { programId: string; role: string }) {
  const [data, setData] = useState<CurriculumData>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [moduleGates, setModuleGates] = useState<ModuleGateMap>({});
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [addingModule, setAddingModule] = useState(false);
  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCreator = CREATOR_ROLES.includes(role);
  const isSA = role === "SUPER_ADMIN" || role === "ADMIN";

  const load = async () => {
    try {
      const [currRes, progressRes] = await Promise.all([
        fetch(`/api/programs/${programId}/curriculum`),
        isCreator ? Promise.resolve(null) : fetch(`/api/curriculum/progress/${programId}`),
      ]);
      if (currRes.ok) {
        const payload = await currRes.json() as { curriculum: CurriculumData };
        setData(payload.curriculum);
        // Auto-expand all modules on first load
        const active = payload.curriculum?.versions?.[0];
        if (active) {
          setExpandedModules(new Set(active.modules.map((m) => m.id)));
        }
      }
      if (progressRes?.ok) {
        const p = await progressRes.json() as { completedLessonIds: string[]; moduleGates?: ModuleGateMap };
        setCompletedIds(new Set(p.completedLessonIds));
        setModuleGates(p.moduleGates ?? {});
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [programId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeVersion = data?.versions?.[0] ?? null;

  const addModule = async (title: string) => {
    if (!activeVersion) return;
    const res = await fetch(`/api/curriculum/versions/${activeVersion.id}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      toast.success("Module added.");
      setAddingModule(false);
      await load();
    } else {
      toast.error("Failed to add module.");
    }
  };

  const addLesson = async (moduleId: string, title: string) => {
    const res = await fetch(`/api/curriculum/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      toast.success("Lesson added.");
      setAddingLessonFor(null);
      await load();
    } else {
      toast.error("Failed to add lesson.");
    }
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    setBusy(true);
    const res = await fetch(`/api/curriculum/modules/${moduleId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Module deleted."); await load(); }
    else { toast.error("Failed to delete."); }
    setBusy(false);
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm("Delete this lesson and all its contents?")) return;
    setBusy(true);
    const res = await fetch(`/api/curriculum/lessons/${lessonId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Lesson deleted."); await load(); }
    else { toast.error("Failed to delete."); }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!activeVersion) {
    return (
      <div className="space-y-4">
        <div className="kat-card flex items-center gap-3">
          <Link href={`/dashboard/curriculum`} className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">← Programs</Link>
        </div>
        <div className="kat-card py-16 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-stone-300 dark:text-stone-600" />
          <p className="font-medium text-stone-600 dark:text-stone-400">No active curriculum version yet.</p>
          {(role === "SUPER_ADMIN" || role === "ADMIN") && (
            <Link href={`/dashboard/curriculum/${programId}/versions`} className="mt-3 inline-block text-sm font-medium text-kat-clay hover:underline">
              Create a version →
            </Link>
          )}
        </div>
      </div>
    );
  }

  /* ── Learner view ── */
  if (!isCreator) {
    const totalLessons = activeVersion.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    const totalCompleted = activeVersion.modules.reduce(
      (sum, m) => sum + m.lessons.filter((l) => completedIds.has(l.id)).length, 0
    );
    const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="kat-card">
          <Link href="/dashboard/curriculum" className="text-xs text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300">
            ← My Courses
          </Link>
          <h2 className="mt-1 [font-family:var(--font-space-grotesk)] text-xl font-bold text-stone-900 dark:text-stone-100">
            Course Outline
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {activeVersion.modules.length} module{activeVersion.modules.length !== 1 ? "s" : ""}
            {" · "}
            {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
          </p>

          {/* Overall progress bar */}
          {totalLessons > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-stone-500 dark:text-stone-400">{totalCompleted}/{totalLessons} completed</span>
                <span className="font-semibold text-kat-clay dark:text-orange-400">{overallPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <div
                  className="h-full rounded-full bg-kat-clay transition-all duration-500"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {activeVersion.modules.length === 0 && (
            <div className="kat-card py-12 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-stone-300 dark:text-stone-600" />
              <p className="text-sm text-stone-400 dark:text-stone-500">No lessons available yet.</p>
            </div>
          )}

          {activeVersion.modules.map((mod, modIndex) => {
            const expanded = expandedModules.has(mod.id);
            const modCompleted = mod.lessons.filter((l) => completedIds.has(l.id)).length;
            const modTotal = mod.lessons.length;
            const modDone = modTotal > 0 && modCompleted === modTotal;
            const gates = moduleGates[mod.id];

            // A module is locked if the previous module hasn't had all its gates passed
            const prevMod = modIndex > 0 ? activeVersion.modules[modIndex - 1] : null;
            const isLocked = prevMod !== null && !(moduleGates[prevMod.id]?.allGatesPassed ?? false);

            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: modIndex * 0.05 }}
                className={`overflow-hidden rounded-lg border bg-white dark:bg-stone-900 ${isLocked ? "border-stone-200/60 dark:border-stone-800/60 opacity-70" : "border-stone-200 dark:border-stone-800"}`}
              >
                {isLocked ? (
                  /* Locked module header, not clickable */
                  <div className="flex w-full items-center gap-4 px-5 py-4 cursor-not-allowed select-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400 dark:bg-stone-800">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-600 dark:text-stone-400">{mod.title}</p>
                      <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                        Complete all gates for the previous module to unlock
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Unlocked module header */
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60"
                    onClick={() => setExpandedModules((prev) => {
                      const next = new Set(prev);
                      if (expanded) { next.delete(mod.id); } else { next.add(mod.id); }
                      return next;
                    })}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      modDone
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-kat-clay/10 text-kat-clay dark:bg-orange-900/30 dark:text-orange-400"
                    }`}>
                      {modDone ? <CheckCircle2 className="h-5 w-5" /> : modIndex + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">{mod.title}</p>
                      {mod.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">{mod.description}</p>
                      )}
                      <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                        {modTotal > 0 ? `${modCompleted}/${modTotal} lessons complete` : "No lessons yet"}
                      </p>
                    </div>
                    <div className="shrink-0 text-stone-400 dark:text-stone-500">
                      {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </div>
                  </button>
                )}

                {/* Gate status strip, shown for unlocked modules */}
                {!isLocked && (
                  <div className="flex flex-wrap gap-3 border-t border-stone-100 px-5 py-2 dark:border-stone-800">
                    <GateIndicator label="Assessment" status={gates?.assessmentGate} />
                    <GateIndicator label="Project" status={gates?.projectGate} />
                    <GateIndicator label="Instructor OK" status={gates?.instructorGate} />
                  </div>
                )}

                {/* Lessons */}
                <AnimatePresence>
                  {!isLocked && expanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-stone-100 dark:border-stone-800">
                        {mod.lessons.length === 0 && (
                          <p className="px-6 py-4 text-sm text-stone-400 dark:text-stone-500">No lessons in this module yet.</p>
                        )}
                        {mod.lessons.map((lesson, lessonIndex) => {
                          const done = completedIds.has(lesson.id);
                          return (
                            <Link
                              key={lesson.id}
                              href={`/dashboard/curriculum/${programId}/lessons/${lesson.id}`}
                              className="flex items-center gap-4 border-b border-stone-50 px-5 py-3.5 transition-colors last:border-0 hover:bg-stone-50 dark:border-stone-800/60 dark:hover:bg-stone-800/40"
                            >
                              {done ? (
                                <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                                  {lessonIndex + 1}
                                </span>
                              )}
                              <span className={`min-w-0 flex-1 text-sm font-medium ${
                                done ? "text-stone-400 dark:text-stone-500" : "text-stone-700 dark:text-stone-300"
                              }`}>
                                {lesson.title}
                              </span>
                              {lesson.contents.length > 0 && (
                                <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                                  {lesson.contents.length} item{lesson.contents.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" />
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Creator / Admin view ── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="kat-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard/curriculum" className="text-xs text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300">← All Programs</Link>
            <h2 className="mt-0.5 [font-family:var(--font-space-grotesk)] text-xl font-bold text-stone-900 dark:text-stone-100">Curriculum</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              v{activeVersion.versionNumber}, {activeVersion.label}
              {activeVersion.publishedAt && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Active</span>
              )}
            </p>
          </div>
          {isSA && (
            <Link
              href={`/dashboard/curriculum/${programId}/versions`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              <Settings className="h-3.5 w-3.5" />
              Manage Versions
            </Link>
          )}
        </div>
      </div>

      {/* Modules */}
      <div className="kat-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-stone-800 dark:text-stone-200">Modules ({activeVersion.modules.length})</h3>
          {isCreator && !addingModule && (
            <Button size="sm" variant="outline" onClick={() => setAddingModule(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />Add Module
            </Button>
          )}
        </div>

        <AnimatePresence>
          {addingModule && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <AddInlineForm placeholder="Module title…" onSubmit={addModule} onCancel={() => setAddingModule(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {activeVersion.modules.length === 0 && !addingModule && (
          <p className="py-6 text-center text-sm text-stone-400 dark:text-stone-500">No modules yet. {isCreator && "Add one above."}</p>
        )}

        {activeVersion.modules.map((mod) => {
          const expanded = expandedModules.has(mod.id);
          return (
            <div key={mod.id} className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800">
              {/* Module header */}
              <div
                className="flex cursor-pointer items-center gap-2 bg-stone-50 px-4 py-3 hover:bg-stone-100 dark:bg-stone-800/60 dark:hover:bg-stone-700"
                onClick={() => setExpandedModules((prev) => {
                  const next = new Set(prev);
                  if (expanded) { next.delete(mod.id); } else { next.add(mod.id); }
                  return next;
                })}
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-stone-400 dark:text-stone-500" /> : <ChevronRight className="h-4 w-4 text-stone-400 dark:text-stone-500" />}
                <BookOpen className="h-4 w-4 text-kat-clay dark:text-orange-400" />
                <span className="flex-1 font-medium text-stone-800 dark:text-stone-200">{mod.title}</span>
                <span className="text-xs text-stone-400 dark:text-stone-500">{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}</span>
                {isSA && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => { e.stopPropagation(); void deleteModule(mod.id); }}
                    className="ml-2 rounded p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-500 dark:text-stone-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                    aria-label="Delete module"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Lessons */}
              <AnimatePresence>
                {expanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="divide-y divide-stone-100 dark:divide-stone-800">
                      {mod.lessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-6 py-2.5">
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/curriculum/${programId}/lessons/${lesson.id}`}
                              className="text-sm font-medium text-stone-700 hover:text-kat-clay hover:underline dark:text-stone-300 dark:hover:text-orange-400"
                            >
                              {lesson.title}
                            </Link>
                          </div>
                          <span className="text-xs text-stone-400 dark:text-stone-500">{lesson.contents.length} item{lesson.contents.length !== 1 ? "s" : ""}</span>
                          {isSA && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deleteLesson(lesson.id)}
                              className="rounded p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-500 dark:text-stone-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                              aria-label="Delete lesson"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add lesson */}
                      {isCreator && (
                        <div className="px-6 py-2">
                          {addingLessonFor === mod.id ? (
                            <AddInlineForm
                              placeholder="Lesson title…"
                              onSubmit={(title) => addLesson(mod.id, title)}
                              onCancel={() => setAddingLessonFor(null)}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAddingLessonFor(mod.id)}
                              className="flex items-center gap-1 text-xs text-stone-400 hover:text-kat-clay dark:text-stone-500 dark:hover:text-orange-400"
                            >
                              <Plus className="h-3 w-3" /> Add lesson
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}