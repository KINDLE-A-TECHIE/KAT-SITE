"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileUp,
  Flame,
  Link2,
  Loader2,
  PlusCircle,
  Star,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import type { UserRoleValue } from "@/lib/enums";

// ── Types ───────────────────────────────────────────────────────────────────

type Program = { id: string; name: string };
type Module = { id: string; title: string };

type MySubmission = {
  id: string;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  submittedAt: string;
  linkUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  weekNumber: number | null;
  points: number;
  dueDate: string | null;
  published: boolean;
  program: Program;
  module: Module | null;
  createdBy?: { firstName: string; lastName: string };
  // For learners — their own submission (max 1)
  submissions?: MySubmission[];
  _count: { submissions: number };
};

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  studentName: string;
  score: number;
  maxPoints: number;
  submittedAt: string;
  isCurrentUser: boolean;
};

type ManagerSubmission = {
  id: string;
  studentId: string;
  linkUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  submittedAt: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  gradedBy: { id: string; firstName: string; lastName: string } | null;
};

type Props = { role: UserRoleValue };

// ── Constants ────────────────────────────────────────────────────────────────

const CARD_ACCENTS = [
  "border-l-violet-400 dark:border-l-violet-500",
  "border-l-cyan-400 dark:border-l-cyan-500",
  "border-l-amber-400 dark:border-l-amber-500",
  "border-l-rose-400 dark:border-l-rose-500",
  "border-l-emerald-400 dark:border-l-emerald-500",
  "border-l-blue-400 dark:border-l-blue-500",
  "border-l-fuchsia-400 dark:border-l-fuchsia-500",
  "border-l-orange-400 dark:border-l-orange-500",
];

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function rankTitle(score: number, total: number): string {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 1) return "Perfect Score! 🌟";
  if (pct >= 0.9) return "Code Wizard 🧙";
  if (pct >= 0.75) return "Bug Slayer ⚔️";
  if (pct >= 0.6) return "Loop Master 🔄";
  return "Rising Star ✨";
}

const LEARNER_ROLES: UserRoleValue[] = ["STUDENT", "FELLOW"];
const MANAGER_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

function accentColor(id: string) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return CARD_ACCENTS[Math.abs(hash) % CARD_ACCENTS.length];
}

function formatDue(dueDate: string | null): { label: string; urgent: boolean } {
  if (!dueDate) return { label: "No deadline", urgent: false };
  const diff = new Date(dueDate).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return { label: "Ended", urgent: false };
  if (days === 0) return { label: "Due today!", urgent: true };
  if (days === 1) return { label: "Due tomorrow", urgent: true };
  if (days <= 3) return { label: `${days} days left`, urgent: true };
  return { label: `${days} days left`, urgent: false };
}

function isActive(c: Challenge) {
  if (!c.dueDate) return true;
  return new Date(c.dueDate).getTime() > Date.now();
}

// ── Leaderboard Dialog ───────────────────────────────────────────────────────

function LeaderboardDialog({
  challenge,
  open,
  onClose,
}: {
  challenge: Challenge;
  open: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/challenges/${challenge.id}/leaderboard`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { leaderboard: LeaderboardEntry[]; totalSubmissions: number }) => {
        setEntries(d.leaderboard);
        setTotalSubmissions(d.totalSubmissions);
      })
      .catch(() => toast.error("Could not load leaderboard"))
      .finally(() => setLoading(false));
  }, [open, challenge.id]);

  const myEntry = entries.find((e) => e.isCurrentUser);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            Challenge Champions
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {challenge.title} · {totalSubmissions} participant{totalSubmissions !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-4xl">🌱</span>
            <p className="font-medium text-slate-600 dark:text-slate-400">No graded submissions yet</p>
            <p className="text-sm text-slate-400">Scores appear here once graded!</p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {/* My position badge if not in top visible */}
            {myEntry && myEntry.rank > 5 && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                You&apos;re ranked #{myEntry.rank} — keep going! 💪
              </p>
            )}

            {/* Top 3 podium */}
            {entries.length >= 3 && (
              <div className="mb-4 flex items-end justify-center gap-2 pt-2">
                {[entries[1], entries[0], entries[2]].map((e, idx) => {
                  const heights = ["h-16 sm:h-20", "h-24 sm:h-28", "h-12 sm:h-16"];
                  const bgs = [
                    "bg-slate-200 dark:bg-slate-700",
                    "bg-amber-300 dark:bg-amber-600",
                    "bg-orange-200 dark:bg-orange-800",
                  ];
                  const medals = ["🥈", "🥇", "🥉"];
                  if (!e) return null;
                  const firstName = e.studentName.split(" ")[0] ?? e.studentName;
                  return (
                    <div key={e.studentId} className="flex flex-col items-center gap-1">
                      <span className={`text-${idx === 1 ? "2xl sm:text-3xl" : "xl sm:text-2xl"}`}>{medals[idx]}</span>
                      <div
                        className={`flex ${heights[idx]} w-16 sm:w-20 items-end justify-center rounded-t-xl ${bgs[idx]} pb-2 text-center text-[10px] sm:text-xs font-bold truncate px-1`}
                      >
                        <span className="truncate">{firstName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full ranked list */}
            {entries.map((e) => (
              <motion.div
                key={e.studentId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  e.isCurrentUser
                    ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:ring-blue-700"
                    : "bg-slate-50 dark:bg-slate-800/50"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-base">
                  {e.rank <= 3 ? MEDAL[e.rank] : <span className="text-xs font-bold text-slate-400">#{e.rank}</span>}
                </span>

                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-[11px] font-bold text-white">
                  {e.studentName.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {e.studentName}{e.isCurrentUser && " (You)"}
                  </p>
                  <p className="text-[10px] text-slate-400">{rankTitle(e.score, e.maxPoints)}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {e.score}
                    <span className="text-[10px] font-normal text-slate-400">/{e.maxPoints}</span>
                  </p>
                  <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-500 transition-all"
                      style={{ width: `${Math.round((e.score / Math.max(e.maxPoints, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Submit Dialog ────────────────────────────────────────────────────────────

function SubmitDialog({
  challenge,
  open,
  onClose,
  onSubmitted,
}: {
  challenge: Challenge;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [tab, setTab] = useState<"link" | "file">("link");
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTab("link");
    setLinkUrl("");
    setNote("");
    setFile(null);
    setUploadProgress(0);
  }

  function handleClose() {
    if (!submitting && !uploading) { reset(); onClose(); }
  }

  async function handleSubmit() {
    if (tab === "link" && !linkUrl.trim()) {
      toast.error("Please paste a link to your work.");
      return;
    }
    if (tab === "file" && !file) {
      toast.error("Please select a file to upload.");
      return;
    }

    setSubmitting(true);
    try {
      let payload: Record<string, unknown> = { note: note.trim() || undefined };

      if (tab === "link") {
        payload.linkUrl = linkUrl.trim();
      } else if (tab === "file" && file) {
        // Step 1: Get presigned upload URL
        setUploading(true);
        const urlRes = await fetch(`/api/challenges/${challenge.id}/submissions/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }),
        });

        if (!urlRes.ok) {
          const err = (await urlRes.json()) as { error?: string };
          toast.error(err.error ?? "Failed to get upload URL");
          return;
        }

        const { uploadUrl, key, publicUrl } = (await urlRes.json()) as {
          uploadUrl: string;
          key: string;
          publicUrl: string;
        };

        // Step 2: Upload to R2
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        setUploading(false);
        payload = {
          ...payload,
          fileUrl: publicUrl,
          fileKey: key,
          fileName: file.name,
          fileMimeType: file.type,
          fileSize: file.size,
        };
      }

      // Step 3: Submit challenge
      const res = await fetch(`/api/challenges/${challenge.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Submission failed");
        return;
      }

      toast.success("Challenge submitted! 🎉 Check the leaderboard!");
      onSubmitted();
      reset();
      onClose();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  const busy = submitting || uploading;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="size-5 text-orange-500" />
            Enter the Challenge!
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {challenge.title}
            {challenge.module && (
              <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {challenge.module.title}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {challenge.description && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {challenge.description}
          </p>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["link", "file"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={busy}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {t === "link" ? <Link2 className="size-3.5" /> : <FileUp className="size-3.5" />}
              {t === "link" ? "Submit a Link" : "Upload a File"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === "link" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Your work URL <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="https://github.com/you/project or https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                disabled={busy}
              />
              <p className="mt-1 text-xs text-slate-400">
                Paste a link to your GitHub repo, Vercel deployment, Codepen, or any live demo.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Upload your file <span className="text-rose-400">*</span>
              </label>
              <div
                onClick={() => !busy && fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-blue-900/20 ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <FileUp className="size-8 text-slate-400" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Click to choose a file</p>
                    <p className="text-xs text-slate-400">Max 50 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {uploading && (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Uploading…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Add a note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Tell your instructor what you built and how it works…"
              className="min-h-[80px] resize-y text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            {busy ? (uploading ? "Uploading…" : "Submitting…") : "Submit Challenge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Grade Submissions Dialog ─────────────────────────────────────────────────

function GradeSubmissionsDialog({
  challenge,
  open,
  onClose,
}: {
  challenge: Challenge;
  open: boolean;
  onClose: () => void;
}) {
  const [submissions, setSubmissions] = useState<ManagerSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    fetch(`/api/challenges/${challenge.id}/submissions`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { submissions: ManagerSubmission[] }) => setSubmissions(d.submissions))
      .catch(() => toast.error("Could not load submissions"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (open) void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setGrade(subId: string, key: "score" | "feedback", value: string) {
    setGrades((prev) => ({
      ...prev,
      [subId]: { score: prev[subId]?.score ?? "", feedback: prev[subId]?.feedback ?? "", [key]: value },
    }));
  }

  async function handleGrade(subId: string) {
    const grade = grades[subId];
    const score = parseInt(grade?.score ?? "", 10);
    if (isNaN(score) || score < 0) {
      toast.error("Enter a valid score.");
      return;
    }

    setSaving(subId);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/submissions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, feedback: grade?.feedback?.trim() || undefined }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to save grade");
        return;
      }

      toast.success("Grade saved! 🎯");
      void load();
      setGrades((prev) => {
        const next = { ...prev };
        delete next[subId];
        return next;
      });
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(null);
    }
  }

  const ungraded = submissions.filter((s) => s.score === null);
  const graded = submissions.filter((s) => s.score !== null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 text-amber-500" />
            Grade Submissions
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {challenge.title} · {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-4xl">📭</span>
            <p className="font-medium text-slate-600 dark:text-slate-400">No submissions yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ungraded.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Awaiting Grade ({ungraded.length})
                </p>
                <div className="space-y-3">
                  {ungraded.map((sub) => (
                    <SubmissionGradeCard
                      key={sub.id}
                      sub={sub}
                      challenge={challenge}
                      grade={grades[sub.id] ?? { score: "", feedback: "" }}
                      onGradeChange={(k, v) => setGrade(sub.id, k, v)}
                      onSave={() => void handleGrade(sub.id)}
                      saving={saving === sub.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {graded.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Graded ({graded.length})
                </p>
                <div className="space-y-3">
                  {graded.map((sub) => (
                    <SubmissionGradeCard
                      key={sub.id}
                      sub={sub}
                      challenge={challenge}
                      grade={grades[sub.id] ?? { score: String(sub.score ?? ""), feedback: sub.feedback ?? "" }}
                      onGradeChange={(k, v) => setGrade(sub.id, k, v)}
                      onSave={() => void handleGrade(sub.id)}
                      saving={saving === sub.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubmissionGradeCard({
  sub,
  challenge,
  grade,
  onGradeChange,
  onSave,
  saving,
}: {
  sub: ManagerSubmission;
  challenge: Challenge;
  grade: { score: string; feedback: string };
  onGradeChange: (key: "score" | "feedback", value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const isGraded = sub.score !== null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-[11px] font-bold text-white">
            {sub.student.firstName.charAt(0)}{sub.student.lastName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {sub.student.firstName} {sub.student.lastName}
            </p>
            <p className="text-[11px] text-slate-400">{sub.student.email}</p>
          </div>
        </div>
        {isGraded && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {sub.score}/{challenge.points} pts
          </Badge>
        )}
      </div>

      {/* Submission content */}
      <div className="mb-2 space-y-1.5">
        {sub.linkUrl && (
          <a
            href={sub.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm text-blue-600 hover:underline dark:bg-slate-700 dark:text-blue-400"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            <span className="truncate">{sub.linkUrl}</span>
          </a>
        )}
        {sub.fileUrl && sub.fileName && (
          <a
            href={sub.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm text-blue-600 hover:underline dark:bg-slate-700 dark:text-blue-400"
          >
            <FileUp className="size-3.5 shrink-0" />
            <span className="truncate">{sub.fileName}</span>
          </a>
        )}
        {sub.note && (
          <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300 italic">
            &ldquo;{sub.note}&rdquo;
          </p>
        )}
      </div>

      {/* Grade form */}
      <div className="flex items-start gap-2">
        <div className="w-24 shrink-0">
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Score / {challenge.points}</label>
          <Input
            type="number"
            min="0"
            max={challenge.points}
            placeholder="0"
            className="h-8 text-sm"
            value={grade.score}
            onChange={(e) => onGradeChange("score", e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Feedback (optional)</label>
          <Input
            placeholder="Great work! Try..."
            className="h-8 text-sm"
            value={grade.feedback}
            onChange={(e) => onGradeChange("feedback", e.target.value)}
          />
        </div>
        <div className="mt-5">
          <Button size="sm" className="h-8 px-3 text-xs gap-1" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
            {isGraded ? "Update" : "Grade"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Create Challenge Dialog ───────────────────────────────────────────────────

function CreateChallengeDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    programId: "",
    moduleId: "none",
    title: "",
    description: "",
    weekNumber: "",
    points: "100",
    dueDate: "",
    published: true,
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/programs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { programs: Program[] }) => setPrograms(d.programs ?? []))
      .catch(() => {});
  }, [open]);

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  useEffect(() => {
    set("moduleId", "none");
    if (!form.programId) { setModules([]); return; }
    fetch(`/api/programs/${form.programId}/modules`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { modules: Module[] }) => setModules(d.modules ?? []))
      .catch(() => setModules([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.programId, set]);

  async function handleSave() {
    if (!form.programId || !form.title.trim()) {
      toast.error("Please fill in program and title.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: form.programId,
          moduleId: form.moduleId !== "none" ? form.moduleId : null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          weekNumber: form.weekNumber ? parseInt(form.weekNumber, 10) : null,
          points: parseInt(form.points, 10) || 100,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
          published: form.published,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to create challenge");
        return;
      }

      toast.success("Challenge created! 🎉");
      onCreated();
      onClose();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="size-5 text-orange-500" />
            New Weekly Challenge
          </DialogTitle>
          <DialogDescription>
            Create a challenge for a program. Students submit links or files and compete on the leaderboard.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Program *</label>
            <Select value={form.programId} onValueChange={(v) => set("programId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Module (optional)</label>
            <Select
              value={form.moduleId}
              onValueChange={(v) => set("moduleId", v)}
              disabled={!form.programId || modules.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={modules.length === 0 ? "No modules yet" : "Select module"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— All enrolled students —</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-slate-400">
              {form.moduleId === "none"
                ? "All active enrollees can see this challenge."
                : "Only students who've reached this module can see it."}
            </p>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Challenge Title *</label>
            <Input
              placeholder="e.g. Build a Calculator App"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
            <Textarea
              placeholder="Describe what students should build, submit, or demonstrate…"
              className="min-h-[70px] resize-y text-sm"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Week #</label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 3"
              value={form.weekNumber}
              onChange={(e) => set("weekNumber", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Points</label>
            <Input
              type="number"
              min="1"
              value={form.points}
              onChange={(e) => set("points", e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Due Date</label>
            <DateInput value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>

          <div className="col-span-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800">
            <input
              id="published-toggle"
              type="checkbox"
              checked={form.published}
              onChange={(e) => set("published", e.target.checked)}
              className="rounded"
            />
            <label htmlFor="published-toggle" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Publish immediately
            </label>
            <span className="text-xs text-slate-400">(students get notified right away)</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <PlusCircle className="size-3.5" />}
            {saving ? "Creating…" : "Create Challenge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Challenge Card ────────────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  isLearner,
  onRefresh,
}: {
  challenge: Challenge;
  isLearner: boolean;
  onRefresh: () => void;
}) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);

  const accent = accentColor(challenge.id);
  const due = formatDue(challenge.dueDate);
  const mySubmission = challenge.submissions?.[0] ?? null;
  const submitted = !!mySubmission;
  const graded = mySubmission?.gradedAt !== null && mySubmission?.score !== null;
  const active = isActive(challenge);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 border-l-4 ${accent}`}
      >
        <div className="p-3 sm:p-4">
          {/* Top meta row */}
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {challenge.weekNumber && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Week {challenge.weekNumber}
              </span>
            )}
            {challenge.module && (
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                {challenge.module.title}
              </span>
            )}
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {challenge.program.name}
            </span>
            {active && due.urgent && (
              <span className="flex items-center gap-0.5 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <Flame className="size-3" />
                {due.label}
              </span>
            )}
            {!challenge.published && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-900 leading-snug dark:text-slate-100">
            {challenge.title}
          </h3>

          {/* Description */}
          {challenge.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {challenge.description}
            </p>
          )}

          {/* Stats row */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Star className="size-3.5 text-amber-400" />
              {challenge.points} pts
            </span>
            {!active && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                Ended
              </span>
            )}
            {active && !due.urgent && challenge.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {due.label}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {challenge._count.submissions} submitted
            </span>
          </div>

          {/* My result (graded) */}
          {graded && mySubmission && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Your score: {mySubmission.score}/{challenge.points}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
                  {rankTitle(mySubmission.score!, challenge.points)}
                </p>
                {mySubmission.feedback && (
                  <p className="mt-0.5 text-[10px] text-slate-500 italic">&ldquo;{mySubmission.feedback}&rdquo;</p>
                )}
              </div>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((mySubmission.score! / Math.max(challenge.points, 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Submitted, awaiting grade */}
          {submitted && !graded && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
              <CheckCircle2 className="size-4 shrink-0 text-blue-500" />
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                Submitted{mySubmission?.linkUrl ? " · link" : mySubmission?.fileName ? ` · ${mySubmission.fileName}` : ""} — awaiting grade
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/30">
          <button
            onClick={() => setBoardOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
          >
            <Trophy className="size-3.5" />
            Leaderboard
          </button>

          <div className="flex-1" />

          {!isLearner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGradeOpen(true)}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              <Star className="size-3" />
              Grade ({challenge._count.submissions})
            </Button>
          )}

          {isLearner && active && !submitted && (
            <Button
              size="sm"
              onClick={() => setSubmitOpen(true)}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              <Zap className="size-3.5" />
              Enter Challenge
            </Button>
          )}

          {isLearner && submitted && mySubmission?.linkUrl && (
            <a
              href={mySubmission.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600"
            >
              <ExternalLink className="size-3.5" />
              Your Submission
            </a>
          )}

          {isLearner && active && submitted && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSubmitOpen(true)}
              className="h-7 gap-1 px-3 text-xs"
            >
              <ChevronRight className="size-3" />
              Resubmit
            </Button>
          )}
        </div>
      </motion.div>

      {isLearner && (
        <SubmitDialog
          challenge={challenge}
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          onSubmitted={onRefresh}
        />
      )}
      <LeaderboardDialog
        challenge={challenge}
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
      />
      {!isLearner && (
        <GradeSubmissionsDialog
          challenge={challenge}
          open={gradeOpen}
          onClose={() => setGradeOpen(false)}
        />
      )}
    </>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ChallengesPanel({ role }: Props) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [createOpen, setCreateOpen] = useState(false);

  const isLearner = LEARNER_ROLES.includes(role);
  const isManager = MANAGER_ROLES.includes(role);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/challenges");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { challenges: Challenge[] };
      setChallenges(data.challenges ?? []);
    } catch {
      toast.error("Could not load challenges");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const active = challenges.filter(isActive);
  const past = challenges.filter((c) => !isActive(c));
  const displayed = tab === "active" ? active : past;

  const featured = active.find((c) => c.dueDate) ?? active[0] ?? null;

  return (
    <div className="space-y-5">
      {/* ── Hero banner (learners only, when there's an active challenge) ── */}
      <AnimatePresence>
        {isLearner && featured && (
          <motion.div
            key={featured.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1F45] via-[#1E5FAF] to-violet-600 px-4 py-5 sm:px-6 sm:py-6 text-white"
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
              <div className="absolute -bottom-8 left-10 h-32 w-32 rounded-full bg-blue-300/10 blur-2xl" />
            </div>

            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                    This Week&apos;s Challenge
                  </span>
                  {featured.weekNumber && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium">
                      Week {featured.weekNumber}
                    </span>
                  )}
                </div>
                <h2 className="[font-family:var(--font-space-grotesk)] text-lg sm:text-xl font-bold leading-snug">
                  {featured.title}
                </h2>
                {featured.module && (
                  <p className="mt-0.5 text-sm text-blue-200">{featured.module.title}</p>
                )}
                {featured.dueDate && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-blue-200">
                    <Clock className="size-3.5" />
                    {formatDue(featured.dueDate).label}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
                  <Star className="size-4 text-amber-300" />
                  {featured.points} pts
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blue-200">
                  <Users className="size-3.5" />
                  {featured._count.submissions} on the board
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["active", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs sm:px-4 sm:text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t === "active"
                ? `Active${active.length > 0 ? ` (${active.length})` : ""}`
                : `Past${past.length > 0 ? ` (${past.length})` : ""}`}
            </button>
          ))}
        </div>

        {isManager && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
            <PlusCircle className="size-3.5" />
            <span className="hidden sm:inline">New Challenge</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </div>

      {/* ── Challenge list ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
          <span className="text-4xl">{tab === "active" ? "🚀" : "📚"}</span>
          <p className="font-medium text-slate-600 dark:text-slate-400">
            {tab === "active" ? "No active challenges right now" : "No past challenges yet"}
          </p>
          {isManager && tab === "active" && (
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="mt-1 gap-1.5">
              <PlusCircle className="size-3.5" />
              Create the first one
            </Button>
          )}
          {isLearner && tab === "active" && (
            <p className="text-sm text-slate-400">Check back soon — a new challenge is coming! 💪</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {displayed.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              isLearner={isLearner}
              onRefresh={() => void load()}
            />
          ))}
        </div>
      )}

      <CreateChallengeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}
