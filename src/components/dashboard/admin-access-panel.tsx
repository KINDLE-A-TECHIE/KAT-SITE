"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw, RotateCcw, ShieldPlus, UserCheck, UserMinus, UserX } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type InviteStatus = "valid" | "used" | "revoked" | "expired";

type AdminInviteRecord = {
  id: string;
  email: string;
  role: "ADMIN" | "INSTRUCTOR";
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
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

type AdminAccountRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "INSTRUCTOR";
  isActive: boolean;
  canGrantRetakes: boolean;
  createdAt: string;
  invitedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  invitedAt: string | null;
};


export function AdminAccessPanel() {
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<AdminInviteRecord[]>([]);
  const [admins, setAdmins] = useState<AdminAccountRecord[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "INSTRUCTOR">("ADMIN");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");

  const activeInviteCount = useMemo(
    () => invites.filter((invite) => invite.status === "valid").length,
    [invites],
  );
  const activeAccountCount = useMemo(
    () => admins.filter((admin) => admin.isActive).length,
    [admins],
  );

  const loadInvites = async () => {
    setLoadingInvites(true);
    const response = await fetch("/api/super-admin/admin-invites");
    const payload = await response.json();
    if (!response.ok) {
      setLoadingInvites(false);
      toast.error(payload?.error ?? "Could not load admin invites.");
      return;
    }
    setInvites(payload.invites ?? []);
    setLoadingInvites(false);
  };

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    const response = await fetch("/api/super-admin/admin-accounts");
    const payload = await response.json();
    if (!response.ok) {
      setLoadingAdmins(false);
      toast.error(payload?.error ?? "Could not load admin accounts.");
      return;
    }
    setAdmins(payload.admins ?? []);
    setLoadingAdmins(false);
  };

  useEffect(() => {
    void Promise.all([loadInvites(), loadAdmins()]);
  }, []);

  const createInvite = async () => {
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/super-admin/admin-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        role: inviteRole,
        expiresInHours: Number(expiresInHours),
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not create admin invite.");
      return;
    }

    setEmail("");
    setInviteRole("ADMIN");
    setExpiresInHours("24");
    setLatestInviteUrl(payload.inviteUrl ?? "");
    toast.success(`${inviteRole === "ADMIN" ? "Admin" : "Instructor"} invite created.`);
    await loadInvites();
  };

  const revokeInvite = async (inviteId: string) => {
    setBusy(true);
    const response = await fetch("/api/super-admin/admin-invites", {
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
      toast.error(payload?.error ?? "Could not revoke admin invite.");
      return;
    }

    toast.success("Invite revoked.");
    await loadInvites();
  };

  const updateAdminStatus = async (adminId: string, action: "hold" | "activate" | "enable-retakes" | "disable-retakes") => {
    setBusy(true);
    const response = await fetch("/api/super-admin/admin-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId,
        action,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not update admin account.");
      return;
    }

    if (action === "hold") toast.success("Account placed on hold.");
    else if (action === "activate") toast.success("Account reactivated.");
    else if (action === "enable-retakes") toast.success("Retake permission enabled.");
    else toast.success("Retake permission disabled.");
    await loadAdmins();
  };

  const removeAdmin = async (adminId: string, name: string) => {
    const confirmed = window.confirm(`Remove ${name} from admin accounts? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setBusy(true);
    const response = await fetch("/api/super-admin/admin-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not remove admin account.");
      return;
    }

    toast.success("Account removed.");
    await loadAdmins();
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
        <div>
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
            Jitsi Meetings
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configured via environment variables (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">JITSI_DOMAIN</code>,{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">JITSI_APP_ID</code>,{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">JITSI_APP_SECRET</code>).
            Contact your system administrator to update these settings.
          </p>
        </div>
      </section>

      <section className="kat-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Invite Admin or Instructor
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Send one-time registration links for admin and instructor onboarding.
            </p>
          </div>
          <span className="kat-chip">{activeInviteCount} active invite(s)</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            placeholder="staff@domain.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "ADMIN" | "INSTRUCTOR")}>
            <SelectTrigger className="h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto" position="popper" side="bottom" align="start" sideOffset={6}>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Expires in hours"
            type="number"
            min={1}
            max={168}
            value={expiresInHours}
            onChange={(event) => setExpiresInHours(event.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void createInvite()}>
            <ShieldPlus className="size-4" />
            {busy ? "Creating..." : "Create Invite"}
          </Button>
          <Button variant="outline" onClick={() => void Promise.all([loadInvites(), loadAdmins()])}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        </div>

        {latestInviteUrl ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">Latest staff invite link</p>
            <p className="mt-1 break-all text-sm text-blue-900 dark:text-blue-300">{latestInviteUrl}</p>
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
        <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">Staff Invite History</h3>
        <div className="mt-3 space-y-3">
          {loadingInvites ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : invites.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No staff invites created yet.</p>
          ) : (
            invites.map((invite, index) => (
              <motion.div
                key={invite.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {invite.email}{" "}
                      <span className="text-xs uppercase text-slate-500 dark:text-slate-400">({invite.role.replace("_", " ")})</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Created by {invite.createdBy.firstName} {invite.createdBy.lastName} on{" "}
                      {new Date(invite.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      invite.status === "valid"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : invite.status === "used"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                          : invite.status === "expired"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                    }`}
                  >
                    {invite.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Expires: {new Date(invite.expiresAt).toLocaleString()}
                </p>
                {invite.usedBy ? (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
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
                    <UserMinus className="size-4" />
                    Revoke
                  </Button>
                ) : null}
              </motion.div>
            ))
          )}
        </div>
      </section>

      <section className="kat-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Staff Access Controls
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Place admin/instructor accounts on hold, reactivate them, or remove access as needed.
            </p>
          </div>
          <span className="kat-chip">{activeAccountCount} active account(s)</span>
        </div>

        <div className="mt-3 space-y-3">
          {loadingAdmins ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : admins.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No admin or instructor accounts found.</p>
          ) : (
            admins.map((admin, index) => (
              <motion.div
                key={admin.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {admin.firstName} {admin.lastName}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {admin.role.replace("_", " ")}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{admin.email}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Joined {new Date(admin.createdAt).toLocaleString()}
                    </p>
                    {admin.invitedBy ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Invited by {admin.invitedBy.firstName} {admin.invitedBy.lastName}
                        {admin.invitedAt ? ` on ${new Date(admin.invitedAt).toLocaleString()}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        admin.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                      }`}
                    >
                      {admin.isActive ? "ACTIVE" : "ON HOLD"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        admin.canGrantRetakes ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {admin.canGrantRetakes ? "Retakes ON" : "Retakes OFF"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {admin.isActive ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void updateAdminStatus(admin.id, "hold")}
                    >
                      <UserX className="size-4" />
                      Put On Hold
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void updateAdminStatus(admin.id, "activate")}
                    >
                      <UserCheck className="size-4" />
                      Reactivate
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void updateAdminStatus(admin.id, admin.canGrantRetakes ? "disable-retakes" : "enable-retakes")}
                    title={admin.canGrantRetakes ? "Revoke retake permission" : "Grant retake permission"}
                  >
                    <RotateCcw className="size-4" />
                    {admin.canGrantRetakes ? "Disable Retakes" : "Enable Retakes"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void removeAdmin(admin.id, `${admin.firstName} ${admin.lastName}`)}
                  >
                    <UserMinus className="size-4" />
                    Remove
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
