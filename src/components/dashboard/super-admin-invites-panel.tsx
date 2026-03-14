"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw, ShieldAlert, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type InviteStatus = "valid" | "used" | "revoked" | "expired";

type InviteRecord = {
  id: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  note: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  usedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  status: InviteStatus;
};

export function SuperAdminInvitesPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");

  const activeCount = useMemo(() => invites.filter((invite) => invite.status === "valid").length, [invites]);

  const loadInvites = async () => {
    setLoading(true);
    const response = await fetch("/api/super-admin/invites");
    const payload = await response.json();
    if (!response.ok) {
      setLoading(false);
      toast.error(payload?.error ?? "Could not load invites.");
      return;
    }
    setInvites(payload.invites ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadInvites();
  }, []);

  const createInvite = async () => {
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/super-admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        note: note.trim() || undefined,
        expiresInHours: Number(expiresInHours),
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not create invite.");
      return;
    }

    setEmail("");
    setNote("");
    setExpiresInHours("24");
    setLatestInviteUrl(payload.inviteUrl ?? "");
    toast.success("Super admin invite created.");
    await loadInvites();
  };

  const revokeInvite = async (inviteId: string) => {
    setBusy(true);
    const response = await fetch("/api/super-admin/invites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteId,
        revoke: true,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not revoke invite.");
      return;
    }

    toast.success("Invite revoked.");
    await loadInvites();
  };

  const copyInviteUrl = async (value: string) => {
    if (!value) {
      toast.error("No invite URL available.");
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success("Invite URL copied.");
  };

  return (
    <div className="space-y-4">
      <section className="kat-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-[var(--font-space-grotesk)] text-lg font-semibold text-slate-900">
              Create Super Admin Invite
            </h3>
            <p className="text-sm text-slate-600">
              Invite links are one-time, auditable, and revocable before use.
            </p>
          </div>
          <span className="kat-chip">{activeCount} active invite(s)</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            placeholder="invitee@domain.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            placeholder="Expires in hours"
            type="number"
            min={1}
            max={168}
            value={expiresInHours}
            onChange={(event) => setExpiresInHours(event.target.value)}
          />
          <Input
            placeholder="Optional note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void createInvite()}>
            <ShieldAlert className="size-4" />
            {busy ? "Creating..." : "Create Invite"}
          </Button>
          <Button variant="outline" onClick={() => void loadInvites()}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        </div>

        {latestInviteUrl ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Latest invite link</p>
            <p className="mt-1 break-all text-sm text-blue-900">{latestInviteUrl}</p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => void copyInviteUrl(latestInviteUrl)}
            >
              <Copy className="size-4" />
              Copy Link
            </Button>
          </div>
        ) : null}
      </section>

      <section className="kat-card">
        <h3 className="font-[var(--font-space-grotesk)] text-lg font-semibold text-slate-900">
          Invite History
        </h3>
        <div className="mt-3 space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : invites.length === 0 ? (
            <p className="text-sm text-slate-600">No invites created yet.</p>
          ) : (
            invites.map((invite, index) => (
              <motion.div
                key={invite.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{invite.email}</p>
                    <p className="text-xs text-slate-600">
                      Created by {invite.createdBy.firstName} {invite.createdBy.lastName} on{" "}
                      {new Date(invite.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      invite.status === "valid"
                        ? "bg-emerald-100 text-emerald-700"
                        : invite.status === "used"
                          ? "bg-blue-100 text-blue-700"
                          : invite.status === "expired"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {invite.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Expires: {new Date(invite.expiresAt).toLocaleString()}
                </p>
                {invite.note ? (
                  <p className="mt-1 text-sm text-slate-700">{invite.note}</p>
                ) : null}
                {invite.usedBy ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Used by {invite.usedBy.firstName} {invite.usedBy.lastName} at{" "}
                    {invite.usedAt ? new Date(invite.usedAt).toLocaleString() : "-"}
                  </p>
                ) : null}
                {invite.status === "valid" ? (
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void revokeInvite(invite.id)}
                  >
                    <XCircle className="size-4" />
                    Revoke
                  </Button>
                ) : null}
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
