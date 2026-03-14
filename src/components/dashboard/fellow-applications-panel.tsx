"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Application = {
  id: string;
  status: string;
  motivation: string;
  experience: string | null;
  submittedAt: string;
  reviewNotes: string | null;
  applicant: { id: string; firstName: string; lastName: string; email: string };
  cohort: { id: string; name: string; startsAt: string } | null;
  reviewedBy: { firstName: string; lastName: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

export function FellowApplicationsPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const loadApplications = async (status: string) => {
    setLoading(true);
    const res = await fetch(`/api/fellows/applications?status=${status}`);
    if (res.ok) {
      const payload = await res.json();
      setApplications(payload.applications ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void loadApplications(statusFilter); }, [statusFilter]);

  const review = async (applicationId: string, decision: "APPROVED" | "REJECTED") => {
    setBusy(applicationId);
    const res = await fetch("/api/fellows/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        status: decision,
        reviewNotes: reviewNotes[applicationId]?.trim() || undefined,
      }),
    });
    const payload = await res.json();
    setBusy(null);
    if (!res.ok) { toast.error(payload?.error ?? "Could not submit review."); return; }
    toast.success(
      decision === "APPROVED"
        ? "Application approved — applicant promoted to Fellow."
        : "Application rejected.",
    );
    setExpanded(null);
    await loadApplications(statusFilter);
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="kat-card flex items-center gap-3">
        <span className="text-sm text-slate-600">Filter by status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40 rounded-xl border border-slate-300 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-slate-400">{applications.length} result{applications.length !== 1 ? "s" : ""}</span>
      </div>

      {/* List */}
      <div className="kat-card space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : applications.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No {statusFilter.toLowerCase()} applications.
          </p>
        ) : (
          applications.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-slate-100 bg-slate-50"
            >
              {/* Summary row */}
              <button
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
                onClick={() => setExpanded(expanded === app.id ? null : app.id)}
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {app.applicant.firstName} {app.applicant.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{app.applicant.email}</p>
                  {app.cohort && (
                    <p className="mt-0.5 text-xs text-blue-600">{app.cohort.name}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    Submitted {new Date(app.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[app.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {app.status}
                </span>
              </button>

              {/* Expanded detail + review */}
              {expanded === app.id && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivation</p>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{app.motivation}</p>
                  </div>
                  {app.experience && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Experience</p>
                      <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{app.experience}</p>
                    </div>
                  )}
                  {app.reviewedBy && (
                    <p className="text-xs text-slate-400">
                      Reviewed by {app.reviewedBy.firstName} {app.reviewedBy.lastName}
                      {app.reviewNotes ? ` · "${app.reviewNotes}"` : ""}
                    </p>
                  )}
                  {app.status === "PENDING" && (
                    <>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-[70px]"
                        placeholder="Optional reviewer note (visible to applicant if rejected)"
                        value={reviewNotes[app.id] ?? ""}
                        onChange={(e) => setReviewNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy === app.id}
                          onClick={() => void review(app.id, "APPROVED")}
                        >
                          {busy === app.id ? "Processing…" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === app.id}
                          onClick={() => void review(app.id, "REJECTED")}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
