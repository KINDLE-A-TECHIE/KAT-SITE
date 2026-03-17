"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, RefreshCcw, ShieldPlus, Unplug, UserCheck, UserMinus, UserX } from "lucide-react";
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
  createdAt: string;
  invitedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  invitedAt: string | null;
};

type ZohoConnectionRecord = {
  accountId: string;
  providerAccountId: string;
  hasRefreshToken: boolean;
  expiresAt: number | null;
  connectedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  connectedAt: string;
  zsoid: string | null;
  presenterId: string;
};

export function AdminAccessPanel() {
  const [loadingZoho, setLoadingZoho] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<AdminInviteRecord[]>([]);
  const [admins, setAdmins] = useState<AdminAccountRecord[]>([]);
  const [zohoConnection, setZohoConnection] = useState<ZohoConnectionRecord | null>(null);
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

  const loadZohoConnection = async () => {
    setLoadingZoho(true);
    const response = await fetch("/api/integrations/zoho/connection", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setLoadingZoho(false);
      toast.error(payload?.error ?? "Could not load Zoho connection status.");
      return;
    }
    setZohoConnection(payload.connected ? (payload.connection as ZohoConnectionRecord) : null);
    setLoadingZoho(false);
  };

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
    void Promise.all([loadZohoConnection(), loadInvites(), loadAdmins()]);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zohoStatus = params.get("zoho");
    if (!zohoStatus) {
      return;
    }

    if (zohoStatus === "connected") {
      toast.success("Zoho Meeting connected.");
    } else if (zohoStatus === "connected_access_only") {
      toast.success("Zoho connected, but no refresh token was issued. Reconnect with consent if needed.");
    } else if (zohoStatus === "disconnected") {
      toast.success("Zoho Meeting disconnected.");
    } else {
      const reason = params.get("reason");
      toast.error(reason ? `Zoho OAuth failed: ${reason}` : "Zoho OAuth failed.");
    }

    params.delete("zoho");
    params.delete("reason");
    const clean = params.toString();
    const next = `${window.location.pathname}${clean ? `?${clean}` : ""}`;
    window.history.replaceState({}, "", next);
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

  const updateAdminStatus = async (adminId: string, action: "hold" | "activate") => {
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

    toast.success(action === "hold" ? "Account placed on hold." : "Account reactivated.");
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

  const startZohoConnect = async () => {
    setBusy(true);
    const response = await fetch("/api/integrations/zoho/start", { cache: "no-store" });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok || !payload?.authUrl) {
      toast.error(payload?.error ?? "Could not start Zoho OAuth.");
      return;
    }
    window.location.href = payload.authUrl as string;
  };

  const disconnectZoho = async () => {
    const confirmed = window.confirm("Disconnect Zoho Meeting for this organization?");
    if (!confirmed) {
      return;
    }

    setBusy(true);
    const response = await fetch("/api/integrations/zoho/connection", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      toast.error(payload?.error ?? "Could not disconnect Zoho Meeting.");
      return;
    }

    toast.success("Zoho Meeting disconnected.");
    await loadZohoConnection();
  };

  return (
    <div className="space-y-4">
      <section className="kat-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900">
              Zoho Session Infrastructure
            </h3>
            <p className="text-sm text-slate-600">
              Connect your institution to enable trusted live session links for instruction and mentorship.
            </p>
          </div>
          <span className={`kat-chip ${zohoConnection ? "bg-emerald-50 text-emerald-700" : ""}`}>
            {zohoConnection ? "Connected" : "Not connected"}
          </span>
        </div>

        {loadingZoho ? (
          <div className="mt-3">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : zohoConnection ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p>
              Connected by {zohoConnection.connectedBy.firstName} {zohoConnection.connectedBy.lastName} (
              {zohoConnection.connectedBy.role}) on {new Date(zohoConnection.connectedAt).toLocaleString()}.
            </p>
            <p className="mt-1 text-xs">
              Presenter ID: {zohoConnection.presenterId} | Refresh token:{" "}
              {zohoConnection.hasRefreshToken ? "available" : "missing"}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No Zoho OAuth connection yet. Connect once to activate live meeting operations.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void startZohoConnect()}>
            <Link2 className="size-4" />
            {zohoConnection ? "Reconnect Zoho" : "Connect Zoho"}
          </Button>
          {zohoConnection ? (
            <Button variant="outline" disabled={busy} onClick={() => void disconnectZoho()}>
              <Unplug className="size-4" />
              Disconnect
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void loadZohoConnection()}>
            <RefreshCcw className="size-4" />
            Check Status
          </Button>
        </div>
      </section>

      <section className="kat-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900">
              Invite Admin or Instructor
            </h3>
            <p className="text-sm text-slate-600">
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
            <SelectTrigger className="h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200">
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
          <Button variant="outline" onClick={() => void Promise.all([loadZohoConnection(), loadInvites(), loadAdmins()])}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        </div>

        {latestInviteUrl ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Latest staff invite link</p>
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
        <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900">Staff Invite History</h3>
        <div className="mt-3 space-y-3">
          {loadingInvites ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : invites.length === 0 ? (
            <p className="text-sm text-slate-600">No staff invites created yet.</p>
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
                    <p className="font-medium text-slate-900">
                      {invite.email}{" "}
                      <span className="text-xs uppercase text-slate-500">({invite.role.replace("_", " ")})</span>
                    </p>
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
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900">
              Staff Access Controls
            </h3>
            <p className="text-sm text-slate-600">
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
            <p className="text-sm text-slate-600">No admin or instructor accounts found.</p>
          ) : (
            admins.map((admin, index) => (
              <motion.div
                key={admin.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {admin.firstName} {admin.lastName}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {admin.role.replace("_", " ")}
                    </p>
                    <p className="text-xs text-slate-600">{admin.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Joined {new Date(admin.createdAt).toLocaleString()}
                    </p>
                    {admin.invitedBy ? (
                      <p className="text-xs text-slate-500">
                        Invited by {admin.invitedBy.firstName} {admin.invitedBy.lastName}
                        {admin.invitedAt ? ` on ${new Date(admin.invitedAt).toLocaleString()}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      admin.isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {admin.isActive ? "ACTIVE" : "ON HOLD"}
                  </span>
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
