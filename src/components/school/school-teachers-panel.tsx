"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Teacher = { id: string; firstName: string; lastName: string; email: string };
type Draft = { firstName: string; lastName: string; email: string };

const EMPTY_DRAFT: Draft = { firstName: "", lastName: "", email: "" };

/**
 * Invite + list + revoke the school's teachers. SCHOOL_ADMIN only (the page guards it).
 * Reads /api/school/teachers so it refreshes after a change without a full reload.
 */
export function SchoolTeachersPanel() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [revoking, setRevoking] = useState<Teacher | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/school/teachers");
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) toast.error(payload?.error ?? "Could not load teachers.");
    setTeachers(payload.teachers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    setBusy(true);
    const res = await fetch("/api/school/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim(),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not invite the teacher.");
      return;
    }
    toast.success(`Invite sent to ${draft.email.trim()}.`);
    setInviteOpen(false);
    setDraft(EMPTY_DRAFT);
    await load();
  };

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    const res = await fetch(`/api/school/teachers?teacherId=${encodeURIComponent(revoking.id)}`, {
      method: "DELETE",
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not remove the teacher.");
      return;
    }
    toast.success(`${revoking.firstName} ${revoking.lastName} was removed.`);
    setRevoking(null);
    await load();
  };

  const canInvite =
    !!draft.firstName.trim() && !!draft.lastName.trim() && !!draft.email.trim();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Teachers</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : teachers.length === 0
                ? "No teachers yet."
                : `${teachers.length} teacher${teachers.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setDraft(EMPTY_DRAFT);
            setInviteOpen(true);
          }}
          className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800"
        >
          <UserPlus className="size-3.5" />
          Invite teacher
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-4 text-sm leading-relaxed text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
            Invite your teachers by email. Each gets a link to set their password, then they can sign
            in, see the classes you assign them, and mark their pupils&rsquo; work. Teachers do not
            use a seat, seats are for pupils.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {teachers.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 dark:text-stone-100">
                    {t.firstName} {t.lastName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                    <Mail className="size-3" />
                    {t.email}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                  onClick={() => setRevoking(t)}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => !o && setInviteOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a teacher</DialogTitle>
            <DialogDescription>
              They get an email with a link to set their password, then they can sign in to your
              school.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={draft.firstName}
                  onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={draft.lastName}
                  onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="teacher@school.edu.ng"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={invite}
              disabled={busy || !canInvite}
              className="bg-orange-700 text-white hover:bg-orange-800"
            >
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {busy ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={revoking !== null} onOpenChange={(o) => !o && setRevoking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this teacher?</DialogTitle>
            <DialogDescription>
              {revoking ? `${revoking.firstName} ${revoking.lastName}` : "This teacher"} loses access
              to your school and is unassigned from any classes. Their account itself is not deleted,
              you can invite them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={revoke} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Remove teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
