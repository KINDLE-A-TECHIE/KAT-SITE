"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Settings2, Trash2, Users, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

type Cohort = {
  id: string;
  name: string;
  programId: string | null;
  programName: string | null;
  applicationOpen: boolean;
  applicationClosesAt: string | null;
  externalApplicationFee: number | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  applicationCount: number;
};

type Program = { id: string; name: string; level: string };

type FellowEnrollment = {
  id: string;
  status: string;
  programId: string;
  programName: string;
  programLevel: string;
};

type ApprovedFellow = {
  applicationId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  enrollments: FellowEnrollment[];
};

type Draft = {
  name: string;
  programId: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  applicationOpen: boolean;
  applicationClosesAt: string;
  externalApplicationFee: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function cohortToDraft(c: Cohort): Draft {
  return {
    name: c.name,
    programId: c.programId ?? "",
    startsAt: toDatetimeLocal(c.startsAt),
    endsAt: toDatetimeLocal(c.endsAt),
    capacity: c.capacity != null ? String(c.capacity) : "",
    applicationOpen: c.applicationOpen,
    applicationClosesAt: toDatetimeLocal(c.applicationClosesAt),
    externalApplicationFee: c.externalApplicationFee != null ? String(c.externalApplicationFee) : "",
  };
}

const emptyNew = (): Draft => ({
  name: "",
  programId: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  applicationOpen: false,
  applicationClosesAt: "",
  externalApplicationFee: "",
});

// ── Shared input styles ────────────────────────────────────────────────────────

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 " +
  "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 " +
  "shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-150 " +
  "focus:border-[#1E5FAF] focus:outline-none focus:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_0_0_3px_rgba(30,95,175,0.12)] " +
  "hover:border-slate-300 dark:hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50";

// ── Small reusable inputs ──────────────────────────────────────────────────────

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-rose-400">*</span>}
        {hint && <span className="ml-1.5 font-normal normal-case text-slate-400 dark:text-slate-500">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className={INPUT_CLS}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="datetime-local"
      className="kat-date-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  min = "0",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string;
}) {
  return (
    <input
      type="number"
      min={min}
      step="1"
      placeholder={placeholder}
      className={INPUT_CLS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ProgramSelect({
  value,
  onChange,
  programs,
  placeholder = "No program linked",
}: {
  value: string;
  onChange: (v: string) => void;
  programs: Program[];
  placeholder?: string;
}) {
  return (
    <select
      className={`${INPUT_CLS} cursor-pointer`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {programs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.level})
        </option>
      ))}
    </select>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CohortsPanel() {
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fellows (per cohort — independently expandable)
  const [fellowsOpen, setFellowsOpen] = useState<Record<string, boolean>>({});
  const [fellowsMap, setFellowsMap] = useState<Record<string, ApprovedFellow[]>>({});
  const [loadingFellows, setLoadingFellows] = useState<Record<string, boolean>>({});
  const [assigningFellow, setAssigningFellow] = useState<Record<string, boolean>>({});
  const [unassigningEnrollment, setUnassigningEnrollment] = useState<Record<string, boolean>>({});
  const [assignProgramId, setAssignProgramId] = useState<Record<string, string>>({});

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyNew());
  const [creating, setCreating] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const [cohortRes, programRes] = await Promise.all([fetch("/api/cohorts"), fetch("/api/programs")]);
      const cohortPayload = await cohortRes.json().catch(() => null);
      const programPayload = await programRes.json().catch(() => null);

      if (!cohortRes.ok) { toast.error((cohortPayload as { error?: string } | null)?.error ?? "Could not load cohorts."); return; }
      if (!programRes.ok) { toast.error((programPayload as { error?: string } | null)?.error ?? "Could not load programs."); return; }
      if (!cohortPayload || !programPayload) { toast.error("Unexpected server response. Please retry."); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawCohorts: any[] = cohortPayload.cohorts ?? [];
      const mapped: Cohort[] = rawCohorts.map((c) => ({
        id: c.id,
        name: c.name,
        programId: c.programId ?? null,
        programName: c.program?.name ?? null,
        applicationOpen: c.applicationOpen ?? false,
        applicationClosesAt: c.applicationClosesAt ?? null,
        externalApplicationFee: c.externalApplicationFee ? Number(c.externalApplicationFee) : null,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        capacity: c.capacity ?? null,
        applicationCount: c._count?.fellowApplications ?? 0,
      }));

      setCohorts(mapped);
      setPrograms(programPayload.programs ?? []);

      const initDrafts: Record<string, Draft> = {};
      for (const c of mapped) initDrafts[c.id] = cohortToDraft(c);
      setDrafts(initDrafts);
    } catch {
      toast.error("Could not load cohorts. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async (cohortId: string) => {
    const draft = drafts[cohortId];
    if (!draft) return;
    setSaving((p) => ({ ...p, [cohortId]: true }));
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          programId: draft.programId || null,
          startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : undefined,
          endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : undefined,
          capacity: draft.capacity ? Number(draft.capacity) : null,
          applicationOpen: draft.applicationOpen,
          applicationClosesAt: draft.applicationClosesAt ? new Date(draft.applicationClosesAt).toISOString() : null,
          externalApplicationFee: draft.externalApplicationFee ? Number(draft.externalApplicationFee) : null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) { toast.error((payload as { error?: string } | null)?.error ?? "Could not save cohort."); return; }
      toast.success("Cohort saved.");
      setCohorts((prev) =>
        prev.map((c) =>
          c.id !== cohortId ? c : {
            ...c,
            name: draft.name,
            programId: draft.programId || null,
            programName: programs.find((p) => p.id === draft.programId)?.name ?? null,
            startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : c.startsAt,
            endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : c.endsAt,
            capacity: draft.capacity ? Number(draft.capacity) : null,
            applicationOpen: draft.applicationOpen,
            applicationClosesAt: draft.applicationClosesAt ? new Date(draft.applicationClosesAt).toISOString() : null,
            externalApplicationFee: draft.externalApplicationFee ? Number(draft.externalApplicationFee) : null,
          },
        ),
      );
    } catch {
      toast.error("Could not save cohort. Please try again.");
    } finally {
      setSaving((p) => ({ ...p, [cohortId]: false }));
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async (cohortId: string) => {
    setDeletingId(cohortId);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, { method: "DELETE" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) { toast.error((payload as { error?: string } | null)?.error ?? "Could not delete cohort."); return; }
      toast.success("Cohort deleted.");
      setCohorts((prev) => prev.filter((c) => c.id !== cohortId));
    } catch {
      toast.error("Could not delete cohort. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ── Create ────────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newDraft.name.trim()) { toast.error("Enter a cohort name."); return; }
    if (!newDraft.startsAt || !newDraft.endsAt) { toast.error("Start and end dates are required."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDraft.name.trim(),
          programId: newDraft.programId || null,
          startsAt: new Date(newDraft.startsAt).toISOString(),
          endsAt: new Date(newDraft.endsAt).toISOString(),
          capacity: newDraft.capacity ? Number(newDraft.capacity) : null,
          applicationOpen: newDraft.applicationOpen,
          applicationClosesAt: newDraft.applicationClosesAt ? new Date(newDraft.applicationClosesAt).toISOString() : null,
          externalApplicationFee: newDraft.externalApplicationFee ? Number(newDraft.externalApplicationFee) : null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) { toast.error((payload as { error?: string } | null)?.error ?? "Could not create cohort."); return; }
      toast.success("Cohort created.");
      setCreateOpen(false);
      setNewDraft(emptyNew());
      void load();
    } catch {
      toast.error("Could not create cohort. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // ── Fellows ───────────────────────────────────────────────────────────────────

  const loadFellows = async (cohortId: string) => {
    setLoadingFellows((p) => ({ ...p, [cohortId]: true }));
    try {
      const res = await fetch(`/api/fellows/enrollments?cohortId=${cohortId}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) { toast.error((payload as { error?: string } | null)?.error ?? "Could not load fellows."); return; }
      setFellowsMap((p) => ({ ...p, [cohortId]: payload?.fellows ?? [] }));
    } catch {
      toast.error("Could not load fellows. Please try again.");
    } finally {
      setLoadingFellows((p) => ({ ...p, [cohortId]: false }));
    }
  };

  const toggleFellows = (cohortId: string) => {
    const next = !fellowsOpen[cohortId];
    setFellowsOpen((p) => ({ ...p, [cohortId]: next }));
    if (next && !fellowsMap[cohortId]) void loadFellows(cohortId);
  };

  const handleAssign = async (cohortId: string, userId: string) => {
    const programId = assignProgramId[userId];
    if (!programId) { toast.error("Select a program first."); return; }
    setAssigningFellow((p) => ({ ...p, [userId]: true }));
    try {
      const res = await fetch("/api/fellows/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, programId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) { toast.error((payload as { error?: string } | null)?.error ?? "Could not assign fellow."); return; }
      toast.success("Fellow assigned to program.");
      setFellowsMap((p) => ({
        ...p,
        [cohortId]: (p[cohortId] ?? []).map((f) =>
          f.userId !== userId ? f : { ...f, enrollments: [...f.enrollments, payload.enrollment] },
        ),
      }));
      setAssignProgramId((p) => ({ ...p, [userId]: "" }));
    } catch {
      toast.error("Could not assign fellow. Please try again.");
    } finally {
      setAssigningFellow((p) => ({ ...p, [userId]: false }));
    }
  };

  const handleUnassign = async (cohortId: string, userId: string, enrollmentId: string) => {
    setUnassigningEnrollment((p) => ({ ...p, [enrollmentId]: true }));
    try {
      const res = await fetch("/api/fellows/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) { toast.error((payload as { error?: string } | null)?.error ?? "Could not remove assignment."); return; }
      toast.success("Program assignment removed.");
      setFellowsMap((p) => ({
        ...p,
        [cohortId]: (p[cohortId] ?? []).map((f) =>
          f.userId !== userId ? f : { ...f, enrollments: f.enrollments.filter((e) => e.id !== enrollmentId) },
        ),
      }));
    } catch {
      toast.error("Could not remove assignment. Please try again.");
    } finally {
      setUnassigningEnrollment((p) => ({ ...p, [enrollmentId]: false }));
    }
  };

  // ── Draft helpers ──────────────────────────────────────────────────────────────

  const updateDraft = (cohortId: string, field: keyof Draft, value: boolean | string) =>
    setDrafts((p) => ({ ...p, [cohortId]: { ...p[cohortId], [field]: value } }));

  const updateNew = (field: keyof Draft, value: boolean | string) =>
    setNewDraft((p) => ({ ...p, [field]: value }));

  // ── Render ────────────────────────────────────────────────────────────────────

  const confirmCohort = cohorts.find((c) => c.id === confirmDeleteId);

  return (
    <div className="space-y-4">
      {/* Header — always visible, even while loading */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? "Loading…" : `${cohorts.length} cohort${cohorts.length !== 1 ? "s" : ""}`}
        </p>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={loading}
          className="gap-1.5 bg-[var(--kat-primary-blue)] text-white hover:bg-[#162d5e] disabled:opacity-50"
        >
          <Plus className="size-4" />
          New Cohort
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : cohorts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">No cohorts yet.</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Click <strong>New Cohort</strong> above to create one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cohorts.map((cohort) => {
            const draft = drafts[cohort.id];
            if (!draft) return null;
            const isSaving = saving[cohort.id] ?? false;
            const isSettingsOpen = settingsOpen[cohort.id] ?? false;
            const isFellowsOpen = fellowsOpen[cohort.id] ?? false;

            return (
              <div key={cohort.id} className="kat-card overflow-hidden">

                {/* ── Summary row ─────────────────────────────────────────────── */}
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    {cohort.programName && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{cohort.programName}</p>
                    )}
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{cohort.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {fmtDate(cohort.startsAt)} &mdash; {fmtDate(cohort.endsAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cohort.applicationOpen ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:ring-emerald-800" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}>
                        {cohort.applicationOpen ? "Applications open" : "Applications closed"}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-800">
                        {cohort.applicationCount} application{cohort.applicationCount !== 1 ? "s" : ""}
                      </span>
                      {cohort.capacity != null && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Capacity: {cohort.capacity}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(cohort.id)}
                      className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:text-slate-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                      title="Delete cohort"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((p) => ({ ...p, [cohort.id]: !isSettingsOpen }))}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isSettingsOpen ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                    >
                      <Settings2 className="size-3.5" />
                      Settings
                      {isSettingsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFellows(cohort.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isFellowsOpen ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                    >
                      <Users className="size-3.5" />
                      Fellows
                      {isFellowsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>
                </div>

                {/* ── Settings panel ───────────────────────────────────────────── */}
                {isSettingsOpen && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <FormField label="Cohort Name" required>
                        <TextInput value={draft.name} onChange={(v) => updateDraft(cohort.id, "name", v)} placeholder="e.g. Cohort 3" />
                      </FormField>
                      <FormField label="Program" hint="optional">
                        <ProgramSelect value={draft.programId} onChange={(v) => updateDraft(cohort.id, "programId", v)} programs={programs} />
                      </FormField>
                      <FormField label="Capacity" hint="blank = unlimited">
                        <NumberInput value={draft.capacity} onChange={(v) => updateDraft(cohort.id, "capacity", v)} placeholder="e.g. 30" min="1" />
                      </FormField>
                      <FormField label="Starts At" required>
                        <DateInput value={draft.startsAt} onChange={(v) => updateDraft(cohort.id, "startsAt", v)} />
                      </FormField>
                      <FormField label="Ends At" required>
                        <DateInput value={draft.endsAt} onChange={(v) => updateDraft(cohort.id, "endsAt", v)} />
                      </FormField>
                      <FormField label="Applications Close At" hint="optional">
                        <DateInput value={draft.applicationClosesAt} onChange={(v) => updateDraft(cohort.id, "applicationClosesAt", v)} />
                      </FormField>
                      <FormField label="External Application Fee ₦" hint="optional">
                        <NumberInput value={draft.externalApplicationFee} onChange={(v) => updateDraft(cohort.id, "externalApplicationFee", v)} placeholder="e.g. 5000" />
                      </FormField>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-[var(--kat-primary-blue)]"
                          checked={draft.applicationOpen}
                          onChange={(e) => updateDraft(cohort.id, "applicationOpen", e.target.checked)}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Applications Open</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Show this cohort on the public fellowship page</p>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleSave(cohort.id)}
                        disabled={isSaving}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--kat-primary-blue)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Fellows panel ────────────────────────────────────────────── */}
                {isFellowsOpen && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Approved Fellows &amp; Program Assignments</p>

                    {loadingFellows[cohort.id] ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                        <Loader2 className="size-4 animate-spin" /> Loading fellows…
                      </div>
                    ) : !fellowsMap[cohort.id]?.length ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500">No approved fellows for this cohort yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {fellowsMap[cohort.id].map((fellow) => {
                          const isAssigning = assigningFellow[fellow.userId] ?? false;
                          const selectedProgram = assignProgramId[fellow.userId] ?? "";
                          const assignedIds = new Set(fellow.enrollments.map((e) => e.programId));
                          const available = programs.filter((p) => !assignedIds.has(p.id));

                          return (
                            <div key={fellow.userId} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{fellow.firstName} {fellow.lastName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{fellow.email}</p>
                              </div>

                              {fellow.enrollments.length > 0 ? (
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {fellow.enrollments.map((e) => {
                                    const isRemoving = unassigningEnrollment[e.id] ?? false;
                                    return (
                                      <span
                                        key={e.id}
                                        className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                      >
                                        {e.programName}
                                        <button
                                          type="button"
                                          disabled={isRemoving}
                                          onClick={() => void handleUnassign(cohort.id, fellow.userId, e.id)}
                                          className="ml-0.5 rounded-full text-blue-400 transition-colors hover:text-rose-500 disabled:opacity-50"
                                          title="Remove assignment"
                                        >
                                          {isRemoving ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="mb-3 text-xs italic text-slate-400 dark:text-slate-500">No programs assigned yet.</p>
                              )}

                              {available.length > 0 ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    className={`flex-1 ${INPUT_CLS}`}
                                    value={selectedProgram}
                                    onChange={(e) => setAssignProgramId((p) => ({ ...p, [fellow.userId]: e.target.value }))}
                                  >
                                    <option value="">Assign to program…</option>
                                    {available.map((p) => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.level})</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={!selectedProgram || isAssigning}
                                    onClick={() => void handleAssign(cohort.id, fellow.userId)}
                                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--kat-primary-blue)] px-4 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                  >
                                    {isAssigning ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                                    Assign
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs italic text-slate-400 dark:text-slate-500">Enrolled in all available programs.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create cohort dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setNewDraft(emptyNew()); } }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Cohort</DialogTitle>
            <DialogDescription>
              Create a new fellowship cohort. Fellows can be assigned to programs independently after approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Cohort Name" required>
                <TextInput value={newDraft.name} onChange={(v) => updateNew("name", v)} placeholder="e.g. Cohort Innovators 2026" />
              </FormField>
              <FormField label="Program" hint="optional">
                <ProgramSelect value={newDraft.programId} onChange={(v) => updateNew("programId", v)} programs={programs} />
              </FormField>
              <FormField label="Starts At" required>
                <DateInput value={newDraft.startsAt} onChange={(v) => updateNew("startsAt", v)} />
              </FormField>
              <FormField label="Ends At" required>
                <DateInput value={newDraft.endsAt} onChange={(v) => updateNew("endsAt", v)} />
              </FormField>
              <FormField label="Capacity" hint="blank = unlimited">
                <NumberInput value={newDraft.capacity} onChange={(v) => updateNew("capacity", v)} placeholder="e.g. 30" min="1" />
              </FormField>
              <FormField label="Applications Close At" hint="optional">
                <DateInput value={newDraft.applicationClosesAt} onChange={(v) => updateNew("applicationClosesAt", v)} />
              </FormField>
              <FormField label="External Application Fee ₦" hint="optional">
                <NumberInput value={newDraft.externalApplicationFee} onChange={(v) => updateNew("externalApplicationFee", v)} placeholder="e.g. 5000" />
              </FormField>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--kat-primary-blue)]"
                checked={newDraft.applicationOpen}
                onChange={(e) => updateNew("applicationOpen", e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Open applications immediately</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">You can change this later from cohort settings</p>
              </div>
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="outline" onClick={() => { setCreateOpen(false); setNewDraft(emptyNew()); }}>
                Cancel
              </Button>
              <Button
                disabled={creating}
                onClick={() => void handleCreate()}
                className="gap-1.5 bg-[var(--kat-primary-blue)] text-white hover:bg-[#162d5e]"
              >
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create Cohort
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ─────────────────────────────────────────── */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete cohort?</DialogTitle>
            <DialogDescription>
              {confirmCohort ? (
                <>
                  <strong>{confirmCohort.name}</strong> will be permanently deleted. This cannot be undone.
                  {confirmCohort.applicationCount > 0 && (
                    <span className="mt-1 block text-rose-600 dark:text-rose-400">
                      This cohort has {confirmCohort.applicationCount} application{confirmCohort.applicationCount !== 1 ? "s" : ""} and cannot be deleted.
                    </span>
                  )}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deletingId !== null || (confirmCohort?.applicationCount ?? 0) > 0}
              onClick={() => confirmDeleteId && void handleDelete(confirmDeleteId)}
            >
              {deletingId ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
