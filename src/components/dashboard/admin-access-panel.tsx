"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw, RotateCcw, Search, ShieldCheck, ShieldPlus, UserCheck, UserMinus, UserX } from "lucide-react";
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
  createdBy: { id: string; firstName: string; lastName: string; email: string };
  usedBy: { id: string; firstName: string; lastName: string; email: string } | null;
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
  invitedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  invitedAt: string | null;
};

type FoundUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

const STATUS_CHIP: Record<InviteStatus, string> = {
  valid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  used: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  revoked: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

export function AdminAccessPanel() {
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<AdminInviteRecord[]>([]);
  const [admins, setAdmins] = useState<AdminAccountRecord[]>([]);

  // Invite form
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "INSTRUCTOR">("ADMIN");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");

  // Promote form
  const [promoteEmail, setPromoteEmail] = useState("");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const activeInviteCount = useMemo(() => invites.filter((i) => i.status === "valid").length, [invites]);
  const activeAccountCount = useMemo(() => admins.filter((a) => a.isActive).length, [admins]);

  const loadInvites = async () => {
    setLoadingInvites(true);
    const res = await fetch("/api/super-admin/admin-invites");
    const payload = await res.json();
    if (!res.ok) { toast.error(payload?.error ?? "Could not load admin invites."); }
    else setInvites(payload.invites ?? []);
    setLoadingInvites(false);
  };

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    const res = await fetch("/api/super-admin/admin-accounts");
    const payload = await res.json();
    if (!res.ok) { toast.error(payload?.error ?? "Could not load admin accounts."); }
    else setAdmins(payload.admins ?? []);
    setLoadingAdmins(false);
  };

  useEffect(() => { void Promise.all([loadInvites(), loadAdmins()]); }, []);

  const createInvite = async () => {
    if (!email.trim()) { toast.error("Email is required."); return; }
    setBusy(true);
    const res = await fetch("/api/super-admin/admin-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role: inviteRole, expiresInHours: Number(expiresInHours) }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Could not create admin invite."); return; }
    setEmail("");
    setInviteRole("ADMIN");
    setExpiresInHours("24");
    setLatestInviteUrl(payload.inviteUrl ?? "");
    toast.success(`${inviteRole === "ADMIN" ? "Admin" : "Instructor"} invite created.`);
    await loadInvites();
  };

  const revokeInvite = async (inviteId: string) => {
    setBusy(true);
    const res = await fetch("/api/super-admin/admin-invites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId, revoke: true }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Could not revoke invite."); return; }
    toast.success("Invite revoked.");
    await loadInvites();
  };

  const updateAdminStatus = async (adminId: string, action: "hold" | "activate" | "enable-retakes" | "disable-retakes") => {
    setBusy(true);
    const res = await fetch("/api/super-admin/admin-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, action }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Could not update admin account."); return; }
    const msgs = { hold: "Account placed on hold.", activate: "Account reactivated.", "enable-retakes": "Retake permission enabled.", "disable-retakes": "Retake permission disabled." };
    toast.success(msgs[action]);
    await loadAdmins();
  };

  const removeAdmin = async (adminId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from admin accounts? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch("/api/super-admin/admin-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Could not remove admin account."); return; }
    toast.success("Account removed.");
    await loadAdmins();
  };

  const copyInviteUrl = async (value: string) => {
    if (!value) { toast.error("No invite URL available."); return; }
    await navigator.clipboard.writeText(value);
    toast.success("Invite URL copied.");
  };

  const searchUser = async () => {
    if (!promoteEmail.trim()) { toast.error("Enter an email to search."); return; }
    setSearchingUser(true);
    setFoundUser(null);
    const res = await fetch(`/api/super-admin/promote?email=${encodeURIComponent(promoteEmail.trim())}`);
    const payload = await res.json();
    setSearchingUser(false);
    if (!res.ok) { toast.error(payload?.error ?? "User not found."); return; }
    setFoundUser(payload.user as FoundUser);
  };

  const promoteUser = async () => {
    if (!foundUser) return;
    if (!window.confirm(`Promote ${foundUser.firstName} ${foundUser.lastName} to Super Admin? This grants full platform access.`)) return;
    setPromoting(true);
    const res = await fetch("/api/super-admin/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: foundUser.id }),
    });
    const payload = await res.json();
    setPromoting(false);
    if (!res.ok) { toast.error(payload?.error ?? "Could not promote user."); return; }
    toast.success(payload.message ?? "User promoted to Super Admin.");
    setPromoteEmail("");
    setFoundUser(null);
  };

  return (
    <div className="space-y-4">

      {/* Jitsi config info */}
      <section className="kat-card">
        <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
          Jitsi Meetings
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Configured via environment variables{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">JITSI_DOMAIN</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">JITSI_APP_ID</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">JITSI_APP_SECRET</code>.
          Contact your system administrator to update these settings.
        </p>
      </section>

      {/* Invite admin / instructor */}
      <section className="kat-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Invite Admin or Instructor
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Send one-time registration links for admin and instructor onboarding.
            </p>
          </div>
          <span className="kat-chip shrink-0">{activeInviteCount} active invite(s)</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            placeholder="staff@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "ADMIN" | "INSTRUCTOR")}>
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
            onChange={(e) => setExpiresInHours(e.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="w-full sm:w-auto" disabled={busy} onClick={() => void createInvite()}>
            <ShieldPlus className="mr-1.5 size-4" />
            {busy ? "Creating..." : "Create Invite"}
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => void Promise.all([loadInvites(), loadAdmins()])}>
            <RefreshCcw className="mr-1.5 size-4" />
            Refresh
          </Button>
        </div>

        {latestInviteUrl ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">Latest staff invite link</p>
            <p className="mt-1 break-all text-sm text-blue-900 dark:text-blue-300">{latestInviteUrl}</p>
            <Button variant="outline" className="mt-2 w-full sm:w-auto" onClick={() => void copyInviteUrl(latestInviteUrl)}>
              <Copy className="mr-1.5 size-4" />
              Copy Link
            </Button>
          </div>
        ) : null}
      </section>

      {/* Promote existing user to Super Admin */}
      <section className="kat-card">
        <div>
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
            Promote to Super Admin
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Find an existing user by email and grant them full super admin access.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="user@email.com"
              value={promoteEmail}
              onChange={(e) => { setPromoteEmail(e.target.value); setFoundUser(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void searchUser(); }}
            />
          </div>
          <Button className="w-full sm:w-auto" variant="outline" disabled={searchingUser} onClick={() => void searchUser()}>
            {searchingUser ? "Searching…" : "Find User"}
          </Button>
        </div>

        {foundUser ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {foundUser.firstName} {foundUser.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{foundUser.email}</p>
                <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {foundUser.role.replace("_", " ")}
                </span>
              </div>
              {foundUser.role === "SUPER_ADMIN" ? (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  Already Super Admin
                </span>
              ) : (
                <Button
                  className="w-full sm:w-auto"
                  disabled={promoting}
                  onClick={() => void promoteUser()}
                >
                  <ShieldCheck className="mr-1.5 size-4" />
                  {promoting ? "Promoting…" : "Promote to Super Admin"}
                </Button>
              )}
            </div>
          </motion.div>
        ) : null}
      </section>

      {/* Staff invite history */}
      <section className="kat-card">
        <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
          Staff Invite History
        </h3>
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {invite.email}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {invite.role.replace("_", " ")}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      By {invite.createdBy.firstName} {invite.createdBy.lastName} · {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_CHIP[invite.status]}`}>
                    {invite.status.toUpperCase()}
                  </span>
                </div>
                {invite.usedBy ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Used by {invite.usedBy.firstName} {invite.usedBy.lastName}
                    {invite.usedAt ? ` · ${new Date(invite.usedAt).toLocaleDateString()}` : ""}
                  </p>
                ) : null}
                {invite.status === "valid" ? (
                  <Button
                    className="mt-3 w-full sm:w-auto"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void revokeInvite(invite.id)}
                  >
                    <UserMinus className="mr-1.5 size-3.5" />
                    Revoke
                  </Button>
                ) : null}
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Staff access controls */}
      <section className="kat-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Staff Access Controls
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Place admin/instructor accounts on hold, reactivate them, or remove access.
            </p>
          </div>
          <span className="kat-chip shrink-0">{activeAccountCount} active account(s)</span>
        </div>

        <div className="mt-3 space-y-3">
          {loadingAdmins ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {admin.firstName} {admin.lastName}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {admin.role.replace("_", " ")}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{admin.email}</p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Joined {new Date(admin.createdAt).toLocaleDateString()}
                      {admin.invitedBy ? ` · Invited by ${admin.invitedBy.firstName} ${admin.invitedBy.lastName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${admin.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>
                      {admin.isActive ? "Active" : "On Hold"}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${admin.canGrantRetakes ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}>
                      {admin.canGrantRetakes ? "Retakes ON" : "Retakes OFF"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {admin.isActive ? (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => void updateAdminStatus(admin.id, "hold")}>
                      <UserX className="mr-1.5 size-3.5" /> Put On Hold
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => void updateAdminStatus(admin.id, "activate")}>
                      <UserCheck className="mr-1.5 size-3.5" /> Reactivate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => void updateAdminStatus(admin.id, admin.canGrantRetakes ? "disable-retakes" : "enable-retakes")}>
                    <RotateCcw className="mr-1.5 size-3.5" />
                    {admin.canGrantRetakes ? "Disable Retakes" : "Enable Retakes"}
                  </Button>
                  <Button size="sm" variant="outline" className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 sm:w-auto dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20" disabled={busy} onClick={() => void removeAdmin(admin.id, `${admin.firstName} ${admin.lastName}`)}>
                    <UserMinus className="mr-1.5 size-3.5" /> Remove
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
