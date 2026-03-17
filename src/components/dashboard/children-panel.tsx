"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { UserPlus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type ChildEnrollment = {
  id: string;
  program: { id: string; name: string; monthlyFee: number };
  cohort: { id: string; name: string } | null;
};

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  enrollments: ChildEnrollment[];
};

type Mode = "idle" | "register" | "link";

export function ChildrenPanel() {
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);

  // Register form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Link form
  const [linkEmail, setLinkEmail] = useState("");

  const loadChildren = async () => {
    setLoading(true);
    const res = await fetch("/api/parent/children");
    if (res.ok) {
      const payload = await res.json();
      setChildren(payload.children ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadChildren();
  }, []);

  const resetForms = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPassword(""); setLinkEmail("");
    setMode("idle");
  };

  const registerChild = async () => {
    if (!firstName || !lastName || !email || !password) {
      toast.error("Fill in all fields.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/parent/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", firstName, lastName, email, password }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Registration failed."); return; }
    toast.success(`Account created for ${payload.child.firstName}.`);
    resetForms();
    await loadChildren();
  };

  const linkChild = async () => {
    if (!linkEmail.trim()) { toast.error("Enter the child's email address."); return; }
    setBusy(true);
    const res = await fetch("/api/parent/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", email: linkEmail.trim() }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Could not link account."); return; }
    toast.success(`${payload.child.firstName} linked to your account.`);
    resetForms();
    await loadChildren();
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      {mode === "idle" && (
        <div className="kat-card flex flex-wrap gap-3">
          <Button onClick={() => setMode("register")} className="gap-2">
            <UserPlus className="size-4" />
            Register New Child
          </Button>
          <Button variant="outline" onClick={() => setMode("link")} className="gap-2">
            <Link2 className="size-4" />
            Link Existing Account
          </Button>
        </div>
      )}

      {/* Register form */}
      {mode === "register" && (
        <div className="kat-card space-y-4">
          <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-800 dark:text-slate-200">
            Register a Student Account
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Creates a new student login for your child. They can use these credentials to log in
            themselves.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input type="email" placeholder="Child's email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void registerChild()}>
              {busy ? "Creating…" : "Create Account"}
            </Button>
            <Button variant="ghost" onClick={resetForms}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Link form */}
      {mode === "link" && (
        <div className="kat-card space-y-4">
          <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-800 dark:text-slate-200">
            Link an Existing Student Account
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            If your child already has a KAT account, enter their email address to link it to yours.
          </p>
          <Input
            type="email"
            placeholder="Child's account email"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
          />
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void linkChild()}>
              {busy ? "Linking…" : "Link Account"}
            </Button>
            <Button variant="ghost" onClick={resetForms}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Children list */}
      <div className="kat-card">
        <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-800 dark:text-slate-200">
          Linked Children
        </h3>
        <div className="mt-4 space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : children.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No children linked yet. Register or link an account above.
            </p>
          ) : (
            children.map((child, i) => (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {child.firstName} {child.lastName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{child.email}</p>
                  </div>
                  <a
                    href={`/dashboard/payments`}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                  >
                    Pay for child
                  </a>
                </div>
                {child.enrollments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {child.enrollments.map((e) => (
                      <span
                        key={e.id}
                        className="rounded-full bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 text-xs text-blue-700 dark:text-blue-400"
                      >
                        {e.program.name}
                        {e.cohort ? ` · ${e.cohort.name}` : ""}
                      </span>
                    ))}
                  </div>
                )}
                {child.enrollments.length === 0 && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">No active enrollments.</p>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
