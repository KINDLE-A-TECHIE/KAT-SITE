"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookOpen, ChevronDown, ChevronRight, GraduationCap,
  Plus, Settings, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type LessonSummary = { id: string; title: string; sortOrder: number; contents: { id: string }[] };
type Module = { id: string; title: string; description: string | null; sortOrder: number; lessons: LessonSummary[] };
type CurriculumVersion = { id: string; versionNumber: number; label: string; isActive: boolean; publishedAt: string | null; createdBy: { firstName: string; lastName: string } };
type CurriculumData = { versions: (CurriculumVersion & { modules: Module[] })[] } | null;

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
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [addingModule, setAddingModule] = useState(false);
  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCreator = CREATOR_ROLES.includes(role);
  const isSA = role === "SUPER_ADMIN" || role === "ADMIN";

  const load = async () => {
    try {
      const res = await fetch(`/api/programs/${programId}/curriculum`);
      if (res.ok) {
        const payload = await res.json() as { curriculum: CurriculumData };
        setData(payload.curriculum);
        // Auto-expand all modules on first load
        const active = payload.curriculum?.versions?.[0];
        if (active) {
          setExpandedModules(new Set(active.modules.map((m) => m.id)));
        }
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
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!activeVersion) {
    return (
      <div className="space-y-4">
        <div className="kat-card flex items-center gap-3">
          <Link href={`/dashboard/curriculum`} className="text-sm text-slate-500 hover:text-slate-800">← Programs</Link>
        </div>
        <div className="kat-card py-16 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">No active curriculum version yet.</p>
          {(role === "SUPER_ADMIN" || role === "ADMIN") && (
            <Link href={`/dashboard/curriculum/${programId}/versions`} className="mt-3 inline-block text-sm font-medium text-[#1E5FAF] hover:underline">
              Create a version →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="kat-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard/curriculum" className="text-xs text-slate-400 hover:text-slate-600">← All Programs</Link>
            <h2 className="mt-0.5 [font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900">Curriculum</h2>
            <p className="text-sm text-slate-500">
              v{activeVersion.versionNumber} — {activeVersion.label}
              {activeVersion.publishedAt && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>
              )}
            </p>
          </div>
          {isSA && (
            <Link
              href={`/dashboard/curriculum/${programId}/versions`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
          <h3 className="font-semibold text-slate-800">Modules ({activeVersion.modules.length})</h3>
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
          <p className="py-6 text-center text-sm text-slate-400">No modules yet. {isCreator && "Add one above."}</p>
        )}

        {activeVersion.modules.map((mod) => {
          const expanded = expandedModules.has(mod.id);
          return (
            <div key={mod.id} className="overflow-hidden rounded-xl border border-slate-200">
              {/* Module header */}
              <div
                className="flex cursor-pointer items-center gap-2 bg-slate-50 px-4 py-3 hover:bg-slate-100"
                onClick={() => setExpandedModules((prev) => {
                  const next = new Set(prev);
                  if (expanded) { next.delete(mod.id); } else { next.add(mod.id); }
                  return next;
                })}
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <BookOpen className="h-4 w-4 text-[#1E5FAF]" />
                <span className="flex-1 font-medium text-slate-800">{mod.title}</span>
                <span className="text-xs text-slate-400">{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}</span>
                {isSA && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => { e.stopPropagation(); void deleteModule(mod.id); }}
                    className="ml-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
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
                    <div className="divide-y divide-slate-100">
                      {mod.lessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-6 py-2.5">
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/curriculum/${programId}/lessons/${lesson.id}`}
                              className="text-sm font-medium text-slate-700 hover:text-[#1E5FAF] hover:underline"
                            >
                              {lesson.title}
                            </Link>
                          </div>
                          <span className="text-xs text-slate-400">{lesson.contents.length} item{lesson.contents.length !== 1 ? "s" : ""}</span>
                          {isSA && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deleteLesson(lesson.id)}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
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
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1E5FAF]"
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