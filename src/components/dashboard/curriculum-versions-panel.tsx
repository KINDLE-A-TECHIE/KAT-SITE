"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Version = {
  id: string;
  versionNumber: number;
  label: string;
  changelog: string | null;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
};

export function CurriculumVersionsPanel({ programId, role }: { programId: string; role: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [changelog, setChangelog] = useState("");
  const [busy, setBusy] = useState(false);

  const isSA = role === "SUPER_ADMIN";

  const load = async () => {
    const res = await fetch(`/api/programs/${programId}/curriculum/versions`);
    if (res.ok) {
      const data = await res.json() as { versions: Version[] };
      setVersions(data.versions ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [programId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createVersion = async () => {
    if (!label.trim()) { toast.error("Label is required."); return; }
    setBusy(true);
    const res = await fetch(`/api/programs/${programId}/curriculum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), changelog: changelog.trim() || undefined }),
    });
    if (res.ok) {
      toast.success("Version created.");
      setCreating(false);
      setLabel("");
      setChangelog("");
      await load();
    } else {
      const p = await res.json() as { error?: string };
      toast.error(p?.error ?? "Failed to create version.");
    }
    setBusy(false);
  };

  const activate = async (versionId: string) => {
    setBusy(true);
    const res = await fetch(`/api/programs/${programId}/curriculum/versions/${versionId}/activate`, { method: "POST" });
    if (res.ok) { toast.success("Version activated!"); await load(); }
    else { toast.error("Failed to activate."); }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="kat-card flex items-center justify-between">
        <div>
          <Link href={`/dashboard/curriculum/${programId}`} className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">← Back to Curriculum</Link>
          <h2 className="mt-0.5 [font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900 dark:text-slate-100">Curriculum Versions</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage and activate curriculum versions for this program.</p>
        </div>
        {isSA && (
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 bg-[#1E5FAF] hover:bg-[#1a52a0]">
            <Plus className="h-4 w-4" />New Version
          </Button>
        )}
      </div>

      {creating && (
        <div className="kat-card space-y-3 border border-[#1E5FAF]/30 bg-blue-50/30 dark:bg-blue-950/20">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">New Curriculum Version</h3>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Label *</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "v2", "Spring 2025 Update"' />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Changelog (optional)</label>
            <Textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="What changed in this version…" rows={3} />
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void createVersion()} className="bg-[#1E5FAF] hover:bg-[#1a52a0]">
              {busy ? "Creating…" : "Create Version"}
            </Button>
            <Button variant="outline" onClick={() => { setCreating(false); setLabel(""); setChangelog(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {versions.length === 0 && !creating && (
        <div className="kat-card py-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="font-medium text-slate-600 dark:text-slate-400">No versions yet.</p>
          {isSA && <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Create your first curriculum version to get started.</p>}
        </div>
      )}

      <div className="space-y-3">
        {versions.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`kat-card ${v.isActive ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">v{v.versionNumber}</span>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{v.label}</h3>
                  {v.isActive && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />Active
                    </span>
                  )}
                </div>
                {v.changelog && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{v.changelog}</p>}
                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  Created by {v.createdBy.firstName} {v.createdBy.lastName} ·{" "}
                  {new Date(v.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  {v.publishedAt && (
                    <> · Activated {new Date(v.publishedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/dashboard/curriculum/${programId}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  View
                </Link>
                {isSA && !v.isActive && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void activate(v.id)}
                    className="bg-emerald-600 text-xs hover:bg-emerald-700"
                  >
                    Activate
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}