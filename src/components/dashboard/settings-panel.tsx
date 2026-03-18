"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Bell,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Moon,
  Shield,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UserRoleValue } from "@/lib/enums";

type Session = {
  id: string;
  sessionToken: string;
  createdAt: string;
  expires: string;
};

type NotifPrefs = {
  newMessage: boolean;
  newMeeting: boolean;
  gradePosted: boolean;
  weeklyDigest: boolean;
};

const NOTIF_PREFS_KEY = "kat-notif-prefs";

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  newMessage: true,
  newMeeting: true,
  gradePosted: true,
  weeklyDigest: false,
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIF_PREFS;
    return { ...DEFAULT_NOTIF_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

function saveNotifPrefs(prefs: NotifPrefs) {
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PasswordTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not update password.");
        return;
      }
      toast.success("Password updated. Signing you out…");
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => void signOut({ callbackUrl: "/login" }), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Change Password</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          After changing your password, all devices will be signed out.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Min. 8 characters"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat new password"
          />
        </div>
        <Button
          type="submit"
          disabled={saving || !current || !next || !confirm}
          className="bg-[#0D1F45] hover:bg-[#162d5e]"
        >
          <KeyRound className="mr-2 size-4" />
          {saving ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

function NotificationsTab({ role }: { role: UserRoleValue }) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(loadNotifPrefs());
    setMounted(true);
  }, []);

  const toggle = (key: keyof NotifPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotifPrefs(updated);
    toast.success("Preference saved.");
  };

  if (!mounted) return null;

  const isLearner = role === "STUDENT" || role === "FELLOW";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Notification Preferences</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Control which in-app and email notifications you receive. Preferences are saved to this device.
        </p>
      </div>

      <div className="space-y-3">
        <NotifRow
          label="New messages"
          description="When someone sends you a direct or group message."
          checked={prefs.newMessage}
          onToggle={() => toggle("newMessage")}
        />
        <Separator />
        <NotifRow
          label="Meeting invites"
          description="When a new session or meeting is scheduled for you."
          checked={prefs.newMeeting}
          onToggle={() => toggle("newMeeting")}
        />
        {isLearner && (
          <>
            <Separator />
            <NotifRow
              label="Grade posted"
              description="When an assessment result or grade is published."
              checked={prefs.gradePosted}
              onToggle={() => toggle("gradePosted")}
            />
          </>
        )}
        <Separator />
        <NotifRow
          label="Weekly summary"
          description="A weekly digest of your activity sent to your email every Monday."
          checked={prefs.weeklyDigest}
          onToggle={() => toggle("weeklyDigest")}
        />
      </div>
    </div>
  );
}

function NotifRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

function AppearanceTab() {
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState((localStorage.getItem("theme") as "light" | "dark" | "system") ?? "light");
    setMounted(true);
  }, []);
  if (!mounted) return null;

  function setTheme(value: "light" | "dark" | "system") {
    localStorage.setItem("theme", value);
    setThemeState(value);
    window.dispatchEvent(new Event("kat-theme-changed"));
  }

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Appearance</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Choose how KAT Learning looks for you.</p>
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-sm">
        {options.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all ${
                active
                  ? "border-[#0D1F45] bg-[#0D1F45]/5 text-[#0D1F45] dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SecurityTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/users/sessions");
      if (res.ok) {
        const data = await res.json() as { sessions: Session[]; currentToken: string | null };
        setSessions(data.sessions);
        setCurrentToken(data.currentToken);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchSessions(); }, []);

  const revokeOthers = async () => {
    setRevoking(true);
    try {
      const res = await fetch("/api/users/sessions", { method: "DELETE" });
      if (res.ok) {
        toast.success("Other sessions revoked.");
        void fetchSessions();
      } else {
        toast.error("Could not revoke sessions.");
      }
    } finally {
      setRevoking(false);
    }
  };

  const revokeAll = async () => {
    setRevoking(true);
    try {
      const res = await fetch("/api/users/sessions?all=true", { method: "DELETE" });
      if (res.ok) {
        toast.success("Signed out of all devices.");
        void signOut({ callbackUrl: "/login" });
      } else {
        toast.error("Could not sign out of all devices.");
      }
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Security</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Manage your active sessions and keep your account secure.
        </p>
      </div>

      {/* Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Active sessions</p>
          {sessions.length > 1 && (
            <button
              type="button"
              disabled={revoking}
              onClick={() => void revokeOthers()}
              className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              Revoke others
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-400">No active sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <Shield className="size-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Session {i + 1}
                    {s.sessionToken === currentToken && (
                      <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">current</span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Started {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}Expires {new Date(s.expires).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 size-4 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold text-rose-800">Sign out of all devices</p>
              <p className="text-xs text-rose-600">
                This will immediately end all active sessions, including this one.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={revoking}
              onClick={() => void revokeAll()}
              className="border-rose-300 text-rose-700 hover:bg-rose-100"
            >
              <LogOut className="mr-2 size-3.5" />
              {revoking ? "Signing out…" : "Sign out everywhere"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export function SettingsPanel({ role }: { role: UserRoleValue }) {
  return (
    <Tabs defaultValue="account" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap gap-1 bg-slate-100 p-1 dark:bg-slate-800">
        <TabsTrigger value="account" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700 dark:text-slate-300">
          <KeyRound className="size-3.5" /> Account
        </TabsTrigger>
        <TabsTrigger value="notifications" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700 dark:text-slate-300">
          <Bell className="size-3.5" /> Notifications
        </TabsTrigger>
        <TabsTrigger value="appearance" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700 dark:text-slate-300">
          <Sun className="size-3.5" /> Appearance
        </TabsTrigger>
        <TabsTrigger value="security" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700 dark:text-slate-300">
          <Lock className="size-3.5" /> Security
        </TabsTrigger>
      </TabsList>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <TabsContent value="account" className="mt-0">
          <PasswordTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-0">
          <NotificationsTab role={role} />
        </TabsContent>
        <TabsContent value="appearance" className="mt-0">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="security" className="mt-0">
          <SecurityTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
