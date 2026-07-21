"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive, BookOpen, EyeOff, GraduationCap, Loader2, Pencil, Plus, Send, Settings, ArchiveRestore,
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
  isPublished: boolean;
  // School programmes are seat-licensed, not priced. audience drives whether fee/discount are shown.
  audience: "B2C" | "SCHOOL";
  nerdcLevel: string | null;
  strand: string | null;
};

type AudienceFilter = "ALL" | "B2C" | "SCHOOL";
type Lifecycle = "DRAFT" | "PUBLISHED" | "ARCHIVED";

function lifecycleOf(p: { isActive: boolean; isPublished: boolean }): Lifecycle {
  if (!p.isActive) return "ARCHIVED";
  return p.isPublished ? "PUBLISHED" : "DRAFT";
}

const LIFECYCLE_BADGE: Record<Lifecycle, string> = {
  DRAFT: "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  ARCHIVED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

const NERDC_LEVEL_LABEL: Record<string, string> = {
  PRIMARY_1_3: "Primary 1–3",
  PRIMARY_4_6: "Primary 4–6",
  JSS: "JSS",
  SSS: "SSS",
};

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  INTERMEDIATE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  ADVANCED:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
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
  audience: "B2C" | "SCHOOL";
  nerdcLevel: string;
  strand: string;
};

const EMPTY_FORM: FormState = {
  name: "", slug: "", description: "", level: "BEGINNER", monthlyFee: "", discountPercent: "",
  audience: "B2C", nerdcLevel: "", strand: "",
};

const NERDC_LEVELS = ["PRIMARY_1_3", "PRIMARY_4_6", "JSS", "SSS"];
const STRANDS: { value: string; label: string }[] = [
  { value: "CODING", label: "Coding" },
  { value: "DIGLIT", label: "Digital literacy" },
];

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ProgramForm({
  initial,
  onSave,
  onCancel,
  busy,
  isSchool = false,
  allowAudienceChange = false,
}: {
  initial: FormState;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
  /** School programmes are seat-licensed; fee/discount don't apply and are hidden. */
  isSchool?: boolean;
  /** Add mode: let the creator choose B2C vs School (and enter NERDC level + strand for School). */
  allowAudienceChange?: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [slugEdited, setSlugEdited] = useState(!!initial.slug);

  // In add mode the audience is chosen here; in edit mode it's fixed (isSchool prop).
  const school = allowAudienceChange ? form.audience === "SCHOOL" : isSchool;

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
        <Label className="text-sm">Description <span className="font-normal text-stone-400 dark:text-stone-500">(optional)</span></Label>
        <Textarea value={form.description} onChange={set("description")} rows={3} placeholder="Brief program overview…" className="text-sm" />
      </div>

      {/* Audience: only choosable at creation. B2C is priced; School is seat-licensed + NERDC-tagged. */}
      {allowAudienceChange && (
        <div className="space-y-1.5">
          <Label className="text-sm">Audience</Label>
          <div className="flex gap-2">
            {(["B2C", "SCHOOL"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setForm((p) => ({ ...p, audience: a }))}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.audience === a ? "border-kat-clay bg-orange-50 text-kat-clay dark:bg-orange-950/30" : "border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300"}`}
              >
                {a === "B2C" ? "B2C (priced)" : "School (seat-licensed)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* School: NERDC level + strand replace the priced fields. Only collected at creation. */}
      {allowAudienceChange && school && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm">NERDC level</Label>
            <select
              value={form.nerdcLevel}
              onChange={set("nerdcLevel")}
              className="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 focus:border-kat-clay focus:outline-none focus:ring-1 focus:ring-kat-clay"
            >
              <option value="">Select level…</option>
              {NERDC_LEVELS.map((l) => <option key={l} value={l}>{NERDC_LEVEL_LABEL[l] ?? l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Strand</Label>
            <select
              value={form.strand}
              onChange={set("strand")}
              className="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 focus:border-kat-clay focus:outline-none focus:ring-1 focus:ring-kat-clay"
            >
              <option value="">Select strand…</option>
              {STRANDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${school ? "" : "sm:grid-cols-3"}`}>
        {/* Level is B2C-only; a school programme's level is derived from its NERDC level. */}
        {!(allowAudienceChange && school) && (
        <div className="space-y-1.5">
          <Label className="text-sm">Level</Label>
          <select
            value={form.level}
            onChange={set("level")}
            className="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 focus:border-kat-clay focus:outline-none focus:ring-1 focus:ring-kat-clay"
          >
            {LEVELS.map((l) => <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        )}
        {/* Fee + discount are B2C-only; a school programme is paid per seat, per term. */}
        {!school && (
          <>
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
              <Label className="text-sm">Discount <span className="font-normal text-stone-400 dark:text-stone-500">(%)</span></Label>
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
          </>
        )}
      </div>
      {school && (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          This is a school programme, seat-licensed per term. There is no monthly fee.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void onSave(form)}
          className="bg-kat-clay hover:bg-kat-clay-deep"
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
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("ALL");
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Program | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Program | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState<string | null>(null);

  // Publish (Draft -> live) or unpublish (back to Draft). The server rejects publishing a programme
  // with no active curriculum version, so surface that message rather than assuming success.
  const togglePublish = async (program: Program) => {
    const publish = !program.isPublished;
    setPublishBusy(program.id);
    try {
      const res = await fetch(`/api/programs/${program.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.error ?? "Could not update the programme."); return; }
      toast.success(publish ? "Programme published." : "Programme moved to draft.");
      await load();
    } catch {
      toast.error("Could not update the programme.");
    } finally {
      setPublishBusy(null);
    }
  };

  const isCreator = CREATOR_ROLES.includes(role);
  const isSA = role === "SUPER_ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      if (isCreator) {
        const params = new URLSearchParams();
        if (isSA && showInactive) params.set("includeInactive", "true");
        if (audienceFilter !== "ALL") params.set("audience", audienceFilter);
        const qs = params.toString();
        const res = await fetch(`/api/programs${qs ? `?${qs}` : ""}`);
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

  useEffect(() => { void load(); }, [role, showInactive, audienceFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => { setEditTarget(null); setDialogMode("add"); };
  const openEdit = (p: Program) => {
    setEditTarget(p);
    setDialogMode("edit");
  };
  const closeDialog = () => { setDialogMode(null); setEditTarget(null); };

  const handleSave = async (form: FormState) => {
    const isAdd = dialogMode === "add";
    const school = isAdd ? form.audience === "SCHOOL" : editTarget?.audience === "SCHOOL";
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    if (!form.slug.trim()) { toast.error("Slug is required."); return; }
    if (isAdd && school && !form.nerdcLevel) { toast.error("NERDC level is required for a school programme."); return; }
    if (isAdd && school && !form.strand) { toast.error("Strand is required for a school programme."); return; }
    if (!school && (!form.monthlyFee || Number(form.monthlyFee) < 0)) { toast.error("Monthly fee is required."); return; }

    setBusy(true);
    try {
      const base = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
      };
      // School create: send audience + NERDC level + strand; the server derives level and sets fee 0.
      // School edit: omit fee/discount entirely (the PATCH schema forbids a non-positive fee).
      // B2C: level + fee + discount as before.
      const payload = school
        ? isAdd
          ? { ...base, level: "BEGINNER", monthlyFee: 0, audience: "SCHOOL", nerdcLevel: form.nerdcLevel, strand: form.strand }
          : { ...base, level: form.level }
        : {
            ...base,
            level: form.level,
            monthlyFee: Number(form.monthlyFee),
            discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
            ...(isAdd ? { audience: "B2C" } : {}),
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
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
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
            <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-stone-900 dark:text-stone-100">
              {isCreator ? "All programmes" : "Your programmes"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isCreator && (
              /* Audience facet: B2C (priced) vs School (seat-licensed). */
              <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 p-0.5 dark:border-stone-700">
                {(["ALL", "B2C", "SCHOOL"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAudienceFilter(a)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${audienceFilter === a ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"}`}
                  >
                    {a === "ALL" ? "All" : a === "B2C" ? "B2C" : "School"}
                  </button>
                ))}
              </div>
            )}
            {isSA && (
              <button
                onClick={() => setShowInactive((p) => !p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${showInactive ? "bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300" : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"}`}
              >
                {showInactive ? "Hide archived" : "Show archived"}
              </button>
            )}
            {isSA && (
              <Button size="sm" onClick={openAdd} className="gap-1.5 bg-kat-clay hover:bg-kat-clay-deep">
                <Plus className="h-3.5 w-3.5" /> Add Program
              </Button>
            )}
            {!isSA && <GraduationCap className="h-8 w-8 text-stone-300" />}
          </div>
        </div>

        {visiblePrograms.length === 0 ? (
          <div className="kat-card py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-stone-300" />
            <p className="font-medium text-stone-600 dark:text-stone-400">
              {isCreator ? "No programs found." : "You are not enrolled in any programs yet."}
            </p>
            <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
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
                          <h3 className="truncate font-semibold text-stone-900 dark:text-stone-100">{program.name}</h3>
                          {isSA && (() => {
                            const status = lifecycleOf(program);
                            return (
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_BADGE[status]}`}>
                                {status.charAt(0) + status.slice(1).toLowerCase()}
                              </span>
                            );
                          })()}
                        </div>
                        {program.audience === "SCHOOL" ? (
                          /* School programmes are paid per seat, per term, not priced here. */
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                            <span className="rounded-full bg-orange-100 px-1.5 py-0.5 font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                              Seat-licensed
                            </span>
                            {program.nerdcLevel ? <span>{NERDC_LEVEL_LABEL[program.nerdcLevel] ?? program.nerdcLevel}</span> : null}
                            {program.strand ? <span>· {program.strand === "DIGLIT" ? "Digital literacy" : "Coding"}</span> : null}
                          </p>
                        ) : (() => {
                          const fee = Number(program.monthlyFee);
                          const disc = program.discountPercent ? Number(program.discountPercent) : 0;
                          const effective = disc > 0 ? fee * (1 - disc / 100) : fee;
                          return (
                            <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
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
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[program.level] ?? "bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400"}`}>
                          {program.level.charAt(0) + program.level.slice(1).toLowerCase()}
                        </span>
                        {isSA && (
                          <>
                            {/* Publish / unpublish, hidden for archived programmes (restore first). */}
                            {program.isActive && (
                              <button
                                onClick={() => void togglePublish(program)}
                                disabled={publishBusy === program.id}
                                title={program.isPublished ? "Unpublish (back to draft)" : "Publish programme"}
                                className="rounded p-1 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-stone-300 disabled:opacity-50"
                              >
                                {publishBusy === program.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : program.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            <button onClick={() => openEdit(program)} title="Edit program" className="rounded p-1 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-stone-300">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setArchiveTarget(program)} title={program.isActive ? "Archive program" : "Restore program"} className="rounded p-1 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-stone-300">
                              {program.isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {program.description && (
                      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-stone-500 dark:text-stone-400">{program.description}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/dashboard/curriculum/${program.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-kat-clay px-3 py-1.5 text-xs font-semibold text-white hover:bg-kat-clay-deep transition-colors">
                        <BookOpen className="h-3.5 w-3.5" />Manage Curriculum
                      </Link>
                      {(isSA || role === "ADMIN") && (
                        <Link href={`/dashboard/curriculum/${program.id}/versions`} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                          <Settings className="h-3.5 w-3.5" />Versions
                        </Link>
                      )}
                    </div>
                  </>
                ) : (
                  /* ── Learner card ── */
                  <>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-kat-clay/10 dark:bg-orange-900/30">
                        <GraduationCap className="h-5 w-5 text-kat-clay dark:text-orange-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-stone-900 dark:text-stone-100">{program.name}</h3>
                        {program.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{program.description}</p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/curriculum/${program.id}`}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-kat-clay py-2.5 text-sm font-semibold text-white transition-colors hover:bg-kat-clay-deep"
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
                ? <>Archiving <span className="font-medium text-stone-700 dark:text-stone-300">{archiveTarget?.name}</span> will hide it from learners and stop new enrollments. Existing data is preserved.</>
                : <>Restoring <span className="font-medium text-stone-700 dark:text-stone-300">{archiveTarget?.name}</span> will make it visible to learners again.</>
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
              {dialogMode === "edit" ? `Edit, ${editTarget?.name}` : "Add New Program"}
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
                    audience: editTarget.audience,
                    nerdcLevel: editTarget.nerdcLevel ?? "",
                    strand: editTarget.strand ?? "",
                    monthlyFee: String(Number(editTarget.monthlyFee)),
                    discountPercent: editTarget.discountPercent ? String(Number(editTarget.discountPercent)) : "",
                  }
                : EMPTY_FORM
            }
            onSave={handleSave}
            onCancel={closeDialog}
            busy={busy}
            isSchool={dialogMode === "edit" && editTarget?.audience === "SCHOOL"}
            allowAudienceChange={dialogMode === "add"}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}