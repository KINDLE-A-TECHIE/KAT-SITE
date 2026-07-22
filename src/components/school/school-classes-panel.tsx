"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, GraduationCap, IdCard, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NERDC_LEVELS = [
  { value: "PRIMARY_1_3", label: "Primary 1–3" },
  { value: "PRIMARY_4_6", label: "Primary 4–6" },
  { value: "JSS", label: "JSS 1–3" },
  { value: "SSS", label: "SSS 1–3" },
] as const;

const NERDC_LABELS: Record<string, string> = Object.fromEntries(
  NERDC_LEVELS.map((l) => [l.value, l.label]),
);

/** Sentinel for "no teacher". Radix Select cannot use an empty-string value. */
const UNASSIGNED = "__unassigned__";

/** The 409 the API returns when a teacher change would strand un-attested teaching. */
type Handover = {
  outgoingTeacher: string;
  unattested: Array<{ moduleId: string; order: number; label: string }>;
};

type Teacher = { id: string; firstName: string; lastName: string; email: string };

type SchoolClass = {
  id: string;
  name: string;
  nerdcLevel: string;
  sessionLabel: string;
  teacherId: string | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
  _count: { enrollments: number };
};

type Draft = { name: string; nerdcLevel: string; sessionLabel: string; teacherId: string };

const EMPTY_DRAFT: Draft = { name: "", nerdcLevel: "PRIMARY_4_6", sessionLabel: "", teacherId: UNASSIGNED };

export function SchoolClassesPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // null = closed; { id: null } = creating; { id } = editing that class
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [cardsBusy, setCardsBusy] = useState<string | null>(null);

  // Session rollover: promote a class's pupils into a new next-session class.
  const [courses, setCourses] = useState<Array<{ id: string; name: string; nerdcLevel: string }>>([]);
  const [rollover, setRollover] = useState<
    { source: SchoolClass; name: string; sessionLabel: string; programId: string; teacherId: string } | null
  >(null);
  const [rollBusy, setRollBusy] = useState(false);

  // Generates fresh PINs for a class and downloads printable sign-in cards. The server renders the
  // PDF (PINs never leave that response) and returns it directly; we just save the blob. Regenerating
  // invalidates any earlier cards, which is the intent when one is lost.
  const makeCards = async (classId: string, className: string) => {
    setCardsBusy(classId);
    try {
      const res = await fetch(`/api/school/classes/${classId}/login-cards`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Could not generate sign-in cards.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sign-in-cards-${className.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "class"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const joinCode = res.headers.get("X-Join-Code");
      toast.success(joinCode ? `New PINs generated. Class code ${joinCode}.` : "New PINs generated.");
    } catch {
      toast.error("Could not generate sign-in cards.");
    } finally {
      setCardsBusy(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, tRes, pRes] = await Promise.all([
      fetch("/api/school/classes"),
      fetch("/api/school/teachers"),
      fetch("/api/programs?audience=SCHOOL"),
    ]);
    const cPayload = await cRes.json().catch(() => ({}));
    const tPayload = await tRes.json().catch(() => ({}));
    const pPayload = await pRes.json().catch(() => ({}));
    if (!cRes.ok) toast.error(cPayload?.error ?? "Could not load classes.");
    setClasses(cPayload.classes ?? []);
    setTeachers(tPayload.teachers ?? []);
    setCourses(pPayload.programs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditing({ id: null });
  };

  const openEdit = (c: SchoolClass) => {
    setDraft({
      name: c.name,
      nerdcLevel: c.nerdcLevel,
      sessionLabel: c.sessionLabel,
      teacherId: c.teacherId ?? UNASSIGNED,
    });
    setEditing({ id: c.id });
  };

  const openRollover = (c: SchoolClass) => {
    // Carry the teacher over by default; the admin picks the next session, name, and course.
    setRollover({ source: c, name: "", sessionLabel: "", programId: "", teacherId: c.teacherId ?? UNASSIGNED });
  };

  const submitRollover = async () => {
    if (!rollover) return;
    const course = courses.find((p) => p.id === rollover.programId);
    if (!course) {
      toast.error("Choose the course pupils are moving up to.");
      return;
    }
    setRollBusy(true);
    const res = await fetch("/api/school/rollover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceClassId: rollover.source.id,
        name: rollover.name,
        sessionLabel: rollover.sessionLabel,
        programId: rollover.programId,
        nerdcLevel: course.nerdcLevel,
        teacherId: rollover.teacherId === UNASSIGNED ? null : rollover.teacherId,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setRollBusy(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not roll over the class.");
      return;
    }
    toast.success(
      `Promoted ${payload.promoted} pupil${payload.promoted === 1 ? "" : "s"} into ${payload.targetClass?.name ?? "the new class"}.`,
    );
    setRollover(null);
    await load();
  };

  const save = async (confirmHandover = false) => {
    if (!editing) return;
    setBusy(true);

    const isEdit = editing.id !== null;
    // The sentinel maps back to null, which explicitly clears the assignment.
    const teacherId = draft.teacherId === UNASSIGNED ? null : draft.teacherId;

    const res = await fetch("/api/school/classes", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? { id: editing.id } : {}),
        name: draft.name,
        nerdcLevel: draft.nerdcLevel,
        sessionLabel: draft.sessionLabel,
        teacherId, ...(confirmHandover ? { confirmHandover: true } : {}),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);

    // The outgoing teacher has un-attested units. Changing teachers now locks her out of the
    // class for good, so anything she taught but never ticked can never be attested by her, and
    // no one else may sign her name. Make the admin see the cost and choose.
    if (res.status === 409 && payload?.details?.code === "UNATTESTED_UNITS") {
      setHandover(payload.details as Handover);
      return;
    }

    if (!res.ok) {
      toast.error(payload?.error ?? "Could not save the class.");
      return;
    }
    toast.success(isEdit ? "Class updated." : "Class created.");
    setHandover(null);
    setEditing(null);
    await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Classes</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : classes.length === 0
                ? "No classes yet."
                : `${classes.length} class${classes.length === 1 ? "" : "es"}.`}
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800">
          <Plus className="size-3.5" />
          New class
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-4 text-sm leading-relaxed text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
            Create your first class, then assign one of your teachers to it. Students you add to a
            class will show up here with their progress.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {classes.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 dark:text-stone-100">{c.name}</p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    {NERDC_LABELS[c.nerdcLevel] ?? c.nerdcLevel} · {c.sessionLabel} ·{" "}
                    {c.teacher ? (
                      `${c.teacher.firstName} ${c.teacher.lastName}`
                    ) : (
                      <span className="text-orange-600">No teacher assigned</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400">
                    {c._count.enrollments} student{c._count.enrollments === 1 ? "" : "s"}
                  </span>
                  <Link
                    href={`/admin/classes/${c.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline"
                  >
                    Results
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={cardsBusy === c.id || c._count.enrollments === 0}
                    onClick={() => void makeCards(c.id, c.name)}
                  >
                    {cardsBusy === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <IdCard className="size-3.5" />}
                    Sign-in cards
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={c._count.enrollments === 0}
                    onClick={() => openRollover(c)}
                    title={c._count.enrollments === 0 ? "No pupils to promote" : "Promote pupils to next session"}
                  >
                    <GraduationCap className="size-3.5" />
                    Roll over
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(c)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Create / edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit class" : "New class"}</DialogTitle>
            <DialogDescription>
              Only teachers who belong to your school can be assigned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="className">Class name</Label>
              <Input
                id="className"
                placeholder="e.g. JSS 2 Blue"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>NERDC level</Label>
              <Select
                value={draft.nerdcLevel}
                onValueChange={(v) => setDraft((d) => ({ ...d, nerdcLevel: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NERDC_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sessionLabel">Session</Label>
              <Input
                id="sessionLabel"
                placeholder="e.g. 2025/2026"
                value={draft.sessionLabel}
                onChange={(e) => setDraft((d) => ({ ...d, sessionLabel: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select
                value={draft.teacherId}
                onValueChange={(v) => setDraft((d) => ({ ...d, teacherId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {teachers.length === 0 ? (
                <p className="text-xs text-stone-400">
                  No teachers in your school yet. You can create the class and assign one later.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => save()}
              disabled={busy || !draft.name.trim() || !draft.sessionLabel.trim()}
              className="bg-orange-700 text-white hover:bg-orange-800"
            >
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {busy ? "Saving…" : editing?.id ? "Save changes" : "Create class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        THE HANDOVER GUARD.

        The outgoing teacher loses access the moment this lands, taking with her the only person
        entitled to attest the units she taught. We will not let the incoming teacher sign the
        outgoing one's name, that would falsify the compliance record. So the cost is shown
        plainly, and the honest path (ask her to attest, then hand over) is the easy one.
      */}
      <Dialog open={handover !== null} onOpenChange={(o) => !o && setHandover(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Un-attested teaching will be lost
            </DialogTitle>
            <DialogDescription>
              <strong className="text-stone-700 dark:text-stone-200">
                {handover?.outgoingTeacher}
              </strong>{" "}
              has not attested {handover?.unattested.length} unit
              {handover?.unattested.length === 1 ? "" : "s"}. Reassigning this class removes their
              access, so they can no longer confirm the teaching they actually did, and no one may
              attest it on their behalf. Those units will read as <em>not delivered</em> on your
              NERDC report.
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-stone-50 p-3 text-sm text-stone-600 dark:bg-stone-800/50 dark:text-stone-300">
            {handover?.unattested.map((u) => (
              <li key={u.moduleId}>
                {u.order}. {u.label}
              </li>
            ))}
          </ul>

          <p className="text-sm text-stone-500 dark:text-stone-400">
            Ask {handover?.outgoingTeacher} to mark what they taught first, then hand the class
            over.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHandover(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => save(true)} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Hand over anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session rollover: promote a class's pupils into a new next-session class. */}
      <Dialog open={rollover !== null} onOpenChange={(o) => !o && setRollover(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Roll over to next session</DialogTitle>
            <DialogDescription>
              Promote {rollover?.source.name}&apos;s pupils into a new class for next session. They move
              onto the next course; their current class is marked complete. The new session&apos;s term
              must be licensed. Repeating the same course is not supported yet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ro-name">New class name</Label>
              <Input
                id="ro-name"
                placeholder="e.g. JSS 2 Blue"
                value={rollover?.name ?? ""}
                onChange={(e) => setRollover((r) => (r ? { ...r, name: e.target.value } : r))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ro-session">New session</Label>
              <Input
                id="ro-session"
                placeholder="e.g. 2026/2027"
                value={rollover?.sessionLabel ?? ""}
                onChange={(e) => setRollover((r) => (r ? { ...r, sessionLabel: e.target.value } : r))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Next course</Label>
              <Select
                value={rollover?.programId ?? ""}
                onValueChange={(v) => setRollover((r) => (r ? { ...r, programId: v } : r))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose the course pupils move up to" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select
                value={rollover?.teacherId ?? UNASSIGNED}
                onValueChange={(v) => setRollover((r) => (r ? { ...r, teacherId: v } : r))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRollover(null)} disabled={rollBusy}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitRollover()}
              disabled={rollBusy || !rollover?.name.trim() || !rollover?.sessionLabel.trim() || !rollover?.programId}
              className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800"
            >
              {rollBusy ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />}
              Roll over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
