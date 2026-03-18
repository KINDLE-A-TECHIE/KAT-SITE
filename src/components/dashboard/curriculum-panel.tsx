"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive, BookOpen, GraduationCap, Pencil, Plus, Settings, ArchiveRestore,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type Program = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  level: string;
  monthlyFee: string | number;
  discountPercent: string | number | null;
  isActive: boolean;
};

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  INTERMEDIATE: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  ADVANCED:     "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  FELLOWSHIP:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "FELLOWSHIP"];

const CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

type FormState = {
  name: string;
  slug: string;
  description: string;
  level: string;
  monthlyFee: string;
  discountPercent: string;
};

const EMPTY_FORM: FormState = {
  name: "", slug: "", description: "", level: "BEGINNER", monthlyFee: "", discountPercent: "",
};

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ProgramForm({
  initial,
  onSave,
  onCancel,
  busy,
}: {
  initial: FormState;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [slugEdited, setSlugEdited] = useState(!!initial.slug);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm((p) => ({ ...p, name, ...(!slugEdited && { slug: toSlug(name) }) }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm">Program Name</Label>
          <Input value={form.name} onChange={handleNameChange} placeholder="e.g. Full-Stack Web Development" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Slug</Label>
          <Input
            value={form.slug}
            onChange={(e) => { setSlugEdited(true); set("slug")(e); }}
            placeholder="e.g. fullstack-web-dev"
            className="font-mono text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Description <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span></Label>
        <Textarea value={form.description} onChange={set("description")} rows={3} placeholder="Brief program overview…" className="text-sm" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Level</Label>
          <select
            value={form.level}
            onChange={set("level")}
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-[#1E5FAF] focus:outline-none focus:ring-1 focus:ring-[#1E5FAF]"
          >
            {LEVELS.map((l) => <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Monthly Fee (₦)</Label>
          <Input
            type="number" min={0} step={100}
            value={form.monthlyFee}
            onChange={set("monthlyFee")}
            placeholder="e.g. 50000"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Discount <span className="font-normal text-slate-400 dark:text-slate-500">(%)</span></Label>
          <Input
            type="number" min={0} max={100} step={1}
            value={form.discountPercent}
            onChange={set("discountPercent")}
            placeholder="e.g. 20"
            className="text-sm"
          />
          {form.monthlyFee && form.discountPercent && Number(form.discountPercent) > 0 && (
            <p className="text-xs text-emerald-600">
              Effective: ₦{(Number(form.monthlyFee) * (1 - Number(form.discountPercent) / 100)).toLocaleString()}/mo
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void onSave(form)}
          className="bg-[#1E5FAF] hover:bg-[#1a4f8f]"
        >
          {busy ? "Saving…" : "Save Program"}
        </Button>
      </div>
    </div>
  );
}

export function CurriculumPanel({ role }: { role: string }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Program | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Program | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const isCreator = CREATOR_ROLES.includes(role);
  const isSA = role === "SUPER_ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      if (isCreator) {
        const res = await fetch(`/api/programs${isSA && showInactive ? "?includeInactive=true" : ""}`);
        if (res.ok) {
          const data = await res.json() as { programs: Program[] };
          setPrograms(data.programs ?? []);
        }
      } else {
        const res = await fetch("/api/enrollments");
        if (res.ok) {
          const data = await res.json() as { enrollments: { program: Program }[] };
          const unique = new Map<string, Program>();
          for (const e of data.enrollments ?? []) {
            if (e.program && !unique.has(e.program.id)) unique.set(e.program.id, e.program);
          }
          setPrograms([...unique.values()]);
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [role, showInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => { setEditTarget(null); setDialogMode("add"); };
  const openEdit = (p: Program) => {
    setEditTarget(p);
    setDialogMode("edit");
  };
  const closeDialog = () => { setDialogMode(null); setEditTarget(null); };

  const handleSave = async (form: FormState) => {
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    if (!form.slug.trim()) { toast.error("Slug is required."); return; }
    if (!form.monthlyFee || Number(form.monthlyFee) < 0) { toast.error("Monthly fee is required."); return; }

    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        level: form.level,
        monthlyFee: Number(form.monthlyFee),
        discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
      };

      const res = dialogMode === "edit" && editTarget
        ? await fetch(`/api/programs/${editTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(dialogMode === "edit" ? "Program updated." : "Program created.");
        closeDialog();
        await load();
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? "Failed to save program.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const action = archiveTarget.isActive ? "archive" : "restore";
    setArchiveBusy(true);
    try {
      const res = await fetch(`/api/programs/${archiveTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Program ${action === "archive" ? "archived" : "restored"}.`);
        setArchiveTarget(null);
        await load();
      } else {
        toast.error(`Failed to ${action} program.`);
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setArchiveBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="kat-card">
          <Skeleton className="mb-2 h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const visiblePrograms = programs.filter((p) => showInactive || p.isActive);

  return (
    <>
      <div className="space-y-4">
        <div className="kat-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900 dark:text-slate-100">
              {isCreator ? "All Programs" : "Your Enrolled Programs"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isCreator
                ? "Manage curriculum, lessons, and learning content."
                : "Browse your program curriculum and learning materials."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSA && (
              <button
                onClick={() => setShowInactive((p) => !p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${showInactive ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
              >
                {showInactive ? "Hide archived" : "Show archived"}
              </button>
            )}
            {isSA && (
              <Button size="sm" onClick={openAdd} className="gap-1.5 bg-[#1E5FAF] hover:bg-[#1a4f8f]">
                <Plus className="h-3.5 w-3.5" /> Add Program
              </Button>
            )}
            {!isSA && <GraduationCap className="h-8 w-8 text-slate-300" />}
          </div>
        </div>

        {visiblePrograms.length === 0 ? (
          <div className="kat-card py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-600 dark:text-slate-400">
              {isCreator ? "No programs found." : "You are not enrolled in any programs yet."}
            </p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
              {isCreator && isSA ? "Click \"Add Program\" to create one." : isCreator ? "Programs can be created by a super admin." : "Contact your admin to get enrolled."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePrograms.map((program, i) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`kat-card flex flex-col ${!program.isActive ? "opacity-60" : ""}`}
              >
                {isCreator ? (
                  /* ── Creator card ── */
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">{program.name}</h3>
                          {!program.isActive && (
                            <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                              Archived
                            </span>
                          )}
                        </div>
                        {(() => {
                          const fee = Number(program.monthlyFee);
                          const disc = program.discountPercent ? Number(program.discountPercent) : 0;
                          const effective = disc > 0 ? fee * (1 - disc / 100) : fee;
                          return (
                            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                              {disc > 0 ? (
                                <>
                                  <span className="line-through">₦{fee.toLocaleString()}</span>
                                  {" "}
                                  <span className="font-medium text-emerald-600">₦{effective.toLocaleString()}/mo</span>
                                  {" "}
                                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">{disc}% off</span>
                                </>
                              ) : (
                                <>₦{fee.toLocaleString()}/mo</>
                              )}
                            </p>
                          );
                        })()}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[program.level] ?? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                          {program.level.charAt(0) + program.level.slice(1).toLowerCase()}
                        </span>
                        {isSA && (
                          <>
                            <button onClick={() => openEdit(program)} title="Edit program" className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setArchiveTarget(program)} title={program.isActive ? "Archive program" : "Restore program"} className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300">
                              {program.isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {program.description && (
                      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{program.description}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/dashboard/curriculum/${program.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E5FAF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a52a0] transition-colors">
                        <BookOpen className="h-3.5 w-3.5" />Manage Curriculum
                      </Link>
                      {(isSA || role === "ADMIN") && (
                        <Link href={`/dashboard/curriculum/${program.id}/versions`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <Settings className="h-3.5 w-3.5" />Versions
                        </Link>
                      )}
                    </div>
                  </>
                ) : (
                  /* ── Learner card ── */
                  <>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E5FAF]/10 dark:bg-blue-900/30">
                        <GraduationCap className="h-5 w-5 text-[#1E5FAF] dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{program.name}</h3>
                        {program.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{program.description}</p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/curriculum/${program.id}`}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E5FAF] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a52a0]"
                    >
                      <BookOpen className="h-4 w-4" />
                      Open Course
                    </Link>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Archive / Restore confirmation dialog */}
      <Dialog open={archiveTarget !== null} onOpenChange={(open) => { if (!open && !archiveBusy) setArchiveTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {archiveTarget?.isActive ? "Archive program?" : "Restore program?"}
            </DialogTitle>
            <DialogDescription>
              {archiveTarget?.isActive
                ? <>Archiving <span className="font-medium text-slate-700 dark:text-slate-300">{archiveTarget?.name}</span> will hide it from learners and stop new enrollments. Existing data is preserved.</>
                : <>Restoring <span className="font-medium text-slate-700 dark:text-slate-300">{archiveTarget?.name}</span> will make it visible to learners again.</>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={archiveBusy} onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={archiveBusy}
              onClick={() => void confirmArchive()}
              className={archiveTarget?.isActive
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {archiveBusy
                ? (archiveTarget?.isActive ? "Archiving…" : "Restoring…")
                : (archiveTarget?.isActive ? "Archive" : "Restore")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit" ? `Edit — ${editTarget?.name}` : "Add New Program"}
            </DialogTitle>
          </DialogHeader>
          <ProgramForm
            initial={
              dialogMode === "edit" && editTarget
                ? {
                    name: editTarget.name,
                    slug: editTarget.slug,
                    description: editTarget.description ?? "",
                    level: editTarget.level,
                    monthlyFee: String(Number(editTarget.monthlyFee)),
                    discountPercent: editTarget.discountPercent ? String(Number(editTarget.discountPercent)) : "",
                  }
                : EMPTY_FORM
            }
            onSave={handleSave}
            onCancel={closeDialog}
            busy={busy}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}