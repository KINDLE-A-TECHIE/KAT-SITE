"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Cohort = { id: string; name: string; startsAt: string; endsAt: string };
type Application = {
  id: string;
  status: string;
  motivation: string;
  submittedAt: string;
  reviewNotes: string | null;
  cohort: { id: string; name: string; startsAt: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

export function FellowApplyPanel({ cohorts }: { cohorts: Cohort[] }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [busy, setBusy] = useState(false);

  const [cohortId, setCohortId] = useState<string>("");
  const [motivation, setMotivation] = useState("");
  const [experience, setExperience] = useState("");

  const loadApplications = async () => {
    setLoadingApps(true);
    const res = await fetch("/api/fellows/applications");
    if (res.ok) {
      const payload = await res.json();
      setApplications(payload.applications ?? []);
    }
    setLoadingApps(false);
  };

  useEffect(() => { void loadApplications(); }, []);

  const hasPending = applications.some((a) => a.status === "PENDING");
  const hasApproved = applications.some((a) => a.status === "APPROVED");

  const submit = async () => {
    if (motivation.trim().length < 50) {
      toast.error("Your motivation statement must be at least 50 characters.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/fellows/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cohortId: cohortId || undefined,
        motivation: motivation.trim(),
        experience: experience.trim() || undefined,
      }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Could not submit application."); return; }
    toast.success("Application submitted! You will be notified of the outcome.");
    setMotivation(""); setExperience(""); setCohortId("");
    await loadApplications();
  };

  return (
    <div className="space-y-4">
      {/* Application form — hide if already approved or pending */}
      {!hasApproved && !hasPending && (
        <div className="kat-card space-y-4">
          <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-800">
            New Application
          </h3>

          {cohorts.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Target Cohort <span className="text-slate-400">(optional)</span>
              </label>
              <Select value={cohortId || undefined} onValueChange={setCohortId}>
                <SelectTrigger className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm">
                  <SelectValue placeholder="Any open cohort" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6}>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {new Date(c.startsAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Why do you want to be a fellow? <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-[120px]"
              placeholder="Tell us about your passion for mentoring, what you've learned so far, and why you'd be a great fellow… (min 50 characters)"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-slate-400">{motivation.length} / 3000</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Relevant experience <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-[80px]"
              placeholder="Projects, leadership roles, tutoring experience, etc."
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
          </div>

          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Submitting…" : "Submit Application"}
          </Button>
        </div>
      )}

      {hasPending && (
        <div className="kat-card rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your application is under review. You will be notified once a decision is made.
        </div>
      )}

      {hasApproved && (
        <div className="kat-card rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Congratulations! Your fellowship application was approved. Your role has been updated.
        </div>
      )}

      {/* Application history */}
      <div className="kat-card">
        <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-800">
          My Applications
        </h3>
        <div className="mt-4 space-y-3">
          {loadingApps ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : applications.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No applications yet.</p>
          ) : (
            applications.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {app.cohort ? app.cohort.name : "Open Fellowship"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Submitted {new Date(app.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[app.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {app.status}
                  </span>
                </div>
                {app.reviewNotes && (
                  <p className="mt-2 text-xs text-slate-600 italic">
                    Reviewer note: {app.reviewNotes}
                  </p>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
