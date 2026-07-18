"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, CheckCircle2, Clock, ExternalLink,
  FileUp, Flame, Link2, Loader2, PlusCircle, Star, Trophy,
  Users, Zap, Eye, EyeOff, Trash2, Medal, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import type { UserRoleValue } from "@/lib/enums";

// ── Types ────────────────────────────────────────────────────────────────────

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
  submissions?: MySubmission[];
  _count: { submissions: number };
};

type Submission = {
  id: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  linkUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
  score: number | null;
  feedback: string | null;
  gradedBy: { firstName: string; lastName: string } | null;
  gradedAt: string | null;
  submittedAt: string;
};

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  studentName: string;
  avatarUrl: string | null;
  score: number;
  maxPoints: number;
  submittedAt: string;
  isCurrentUser: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_ACCENTS = [
  "border-l-orange-400", "border-l-orange-400", "border-l-amber-400", "border-l-rose-400",
  "border-l-emerald-400", "border-l-orange-400", "border-l-orange-400", "border-l-orange-400",
];
const MEDAL_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const LEARNER_ROLES: UserRoleValue[] = ["STUDENT", "FELLOW"];
const MANAGER_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

function accentFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return CARD_ACCENTS[Math.abs(h) % CARD_ACCENTS.length];
}

function rankTitle(score: number, max: number) {
  const p = max > 0 ? score / max : 0;
  if (p >= 1) return "Perfect Score! 🌟";
  if (p >= 0.9) return "Code Wizard 🧙";
  if (p >= 0.75) return "Bug Slayer ⚔️";
  if (p >= 0.6) return "Loop Master 🔄";
  return "Rising Star ✨";
}

function dueMeta(dueDate: string | null): { label: string; urgent: boolean; ended: boolean } {
  if (!dueDate) return { label: "No deadline", urgent: false, ended: false };
  const diff = new Date(dueDate).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return { label: "Ended", urgent: false, ended: true };
  if (days === 0) return { label: "Due today!", urgent: true, ended: false };
  if (days === 1) return { label: "Due tomorrow", urgent: true, ended: false };
  if (days <= 3) return { label: `${days} days left`, urgent: true, ended: false };
  return { label: `${days} days left`, urgent: false, ended: false };
}

// ── Leaderboard Dialog ────────────────────────────────────────────────────────

function LeaderboardDialog({ challenge, open, onClose }: {
  challenge: Challenge; open: boolean; onClose: () => void;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [myRankEntry, setMyRankEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/challenges/${challenge.id}/leaderboard`)
      .then((r) => r.ok ? r.json() as Promise<{ leaderboard: LeaderboardEntry[]; totalSubmissions: number; currentUserEntry: LeaderboardEntry | null }> : Promise.reject())
      .then((d) => { setEntries(d.leaderboard); setTotal(d.totalSubmissions); setMyRankEntry(d.currentUserEntry ?? null); })
      .catch(() => toast.error("Could not load leaderboard"))
      .finally(() => setLoading(false));
  }, [open, challenge.id]);

  const myEntry = entries.find((e) => e.isCurrentUser) ?? myRankEntry;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />Challenge Champions
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            {challenge.title} · {total} participant{total !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 pt-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-5xl">🌱</span>
            <p className="font-semibold text-stone-600 dark:text-stone-400">No scores yet</p>
            <p className="text-sm text-stone-400">Be the first on the board!</p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {myEntry && myEntry.rank > 5 && (
              <p className="rounded-lg bg-orange-50 px-3 py-2 text-center text-sm font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                You&apos;re ranked #{myEntry.rank}, keep going! 💪
              </p>
            )}
            {entries.length >= 3 && (
              <div className="mb-4 flex items-end justify-center gap-2 pt-2">
                {[entries[1], entries[0], entries[2]].map((e, pos) => {
                  const heights = ["h-16", "h-24", "h-12"];
                  const bg = ["bg-stone-200 dark:bg-stone-700", "bg-amber-300 dark:bg-amber-600", "bg-orange-200 dark:bg-orange-800"];
                  const textColor = ["text-stone-600 dark:text-stone-300", "text-amber-900 dark:text-amber-100", "text-orange-800 dark:text-orange-200"];
                  if (!e) return null;
                  return (
                    <div key={e.studentId} className="flex flex-col items-center gap-1">
                      <span className="text-2xl">{MEDAL_EMOJI[e.rank]}</span>
                      <div className={`flex w-20 items-end justify-center rounded-t-xl ${bg[pos]} pb-2 text-center text-xs font-bold ${textColor[pos]} truncate px-1 ${heights[pos]}`}>
                        {e.studentName.split(" ")[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {entries.map((e) => (
              <motion.div key={e.studentId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${e.isCurrentUser ? "bg-orange-50 ring-1 ring-orange-200 dark:bg-orange-900/30 dark:ring-orange-700" : "bg-stone-50 dark:bg-stone-800/50"}`}
              >
                <span className="w-6 text-center text-base">
                  {e.rank <= 3 ? MEDAL_EMOJI[e.rank] : <span className="text-xs font-bold text-stone-400">#{e.rank}</span>}
                </span>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-[11px] font-bold text-white">
                  {e.studentName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-200">
                    {e.studentName}{e.isCurrentUser ? " (You)" : ""}
                  </p>
                  <p className="text-[10px] text-stone-400">{rankTitle(e.score, e.maxPoints)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-stone-700 dark:text-stone-200">
                    {e.score}<span className="text-[10px] font-normal text-stone-400">/{e.maxPoints}</span>
                  </p>
                  <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500" style={{ width: `${Math.round((e.score / Math.max(e.maxPoints, 1)) * 100)}%` }} />
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

// ── Submit Dialog (Learner) ────────────────────────────────────────────────────

function SubmitDialog({ challenge, open, onClose, onSubmitted }: {
  challenge: Challenge; open: boolean; onClose: () => void; onSubmitted: () => void;
}) {
  const [tab, setTab] = useState<"link" | "file">("link");
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() { setLinkUrl(""); setNote(""); setFile(null); setTab("link"); }

  async function handleSubmit() {
    if (tab === "link" && !linkUrl.trim()) { toast.error("Please paste a link to your work."); return; }
    if (tab === "file" && !file) { toast.error("Please select a file to upload."); return; }

    setSubmitting(true);
    try {
      let payload: Record<string, unknown> = { note: note.trim() || undefined };

      if (tab === "link") {
        payload.linkUrl = linkUrl.trim();
      } else if (file) {
        setUploading(true);
        const mimeType = file.type || "application/octet-stream";
        const urlRes = await fetch(`/api/challenges/${challenge.id}/submissions/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, mimeType, size: file.size }),
        });
        if (!urlRes.ok) {
          const e = await urlRes.json() as { error?: string };
          toast.error(e.error ?? "Upload failed. Try a link instead.");
          return;
        }
        const { uploadUrl, key, publicUrl, name, size } = await urlRes.json() as {
          uploadUrl: string; key: string; publicUrl: string; name: string; mimeType: string; size: number;
        };
        setUploading(false);
        const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": mimeType } });
        if (!putRes.ok) {
          console.error("[challenge upload] R2 PUT failed", putRes.status, await putRes.text().catch(() => ""));
          toast.error("File upload failed. Check your connection or try a link instead.");
          return;
        }
        payload = { ...payload, fileUrl: publicUrl, fileKey: key, fileName: name, fileMimeType: mimeType, fileSize: size };
      }

      const res = await fetch(`/api/challenges/${challenge.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Submission failed");
        return;
      }
      toast.success("Challenge submitted! 🎉 Check the leaderboard for your score!");
      reset(); onSubmitted(); onClose();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false); setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="size-5 text-orange-500" />
            Enter the Challenge!
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            {challenge.title}
            {challenge.module && (
              <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {challenge.module.title}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {challenge.description && (
          <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {challenge.description}
          </p>
        )}


        <div className="flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
          {([["link", Link2, "Share a Link"], ["file", FileUp, "Upload a File"]] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${tab === t ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100" : "text-stone-500 hover:text-stone-700"}`}
            >
              <Icon className="size-4" />{label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === "link" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Link to your work <span className="text-stone-400">(GitHub, CodePen, live demo…)</span>
              </label>
              <Input placeholder="https://github.com/you/your-project" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="text-sm" />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Upload your file <span className="text-stone-400">(max 50 MB)</span>
              </label>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-emerald-700 dark:text-emerald-400">{file.name}</p>
                  <button onClick={() => setFile(null)} className="shrink-0 text-xs text-stone-400 hover:text-red-500">Remove</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-200 py-6 text-center transition hover:border-orange-300 hover:bg-orange-50/50 dark:border-stone-700 dark:hover:border-orange-600"
                >
                  <FileUp className="size-6 text-stone-400" />
                  <span className="text-sm font-medium text-stone-500">Click to choose a file</span>
                  <span className="text-xs text-stone-400">ZIP, PDF, images, or any file up to 50 MB</span>
                </button>
              )}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Notes <span className="text-stone-400">(optional)</span>
            </label>
            <Textarea placeholder="Describe what you built, challenges you faced, or what you're proud of…" className="min-h-[70px] resize-y text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting || uploading} className="gap-1.5">
            {(submitting || uploading) ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {uploading ? "Uploading…" : submitting ? "Submitting…" : "Submit Challenge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Grade Submissions Dialog (Manager) ────────────────────────────────────────

function GradeSubmissionsDialog({ challenge, open, onClose }: {
  challenge: Challenge; open: boolean; onClose: () => void;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string; saving: boolean }>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/challenges/${challenge.id}/submissions`)
      .then((r) => r.ok ? r.json() as Promise<{ submissions: Submission[] }> : Promise.reject())
      .then((d) => {
        setSubmissions(d.submissions);
        const init: Record<string, { score: string; feedback: string; saving: boolean }> = {};
        d.submissions.forEach((s) => { init[s.id] = { score: s.score?.toString() ?? "", feedback: s.feedback ?? "", saving: false }; });
        setGrading(init);
      })
      .catch(() => toast.error("Could not load submissions"))
      .finally(() => setLoading(false));
  }, [open, challenge.id]);

  async function saveGrade(submissionId: string) {
    const g = grading[submissionId];
    if (!g || g.score === "") { toast.error("Enter a score first."); return; }
    const score = parseInt(g.score, 10);
    if (isNaN(score) || score < 0) { toast.error("Invalid score."); return; }
    setGrading((prev) => ({ ...prev, [submissionId]: { ...prev[submissionId], saving: true } }));
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, feedback: g.feedback.trim() || undefined }),
      });
      if (!res.ok) { toast.error("Failed to save grade."); return; }
      const { submission } = await res.json() as { submission: Submission };
      setSubmissions((prev) => prev.map((s) => s.id === submissionId ? submission : s));
      toast.success(`Graded! ${score}/${challenge.points} pts`);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setGrading((prev) => ({ ...prev, [submissionId]: { ...prev[submissionId], saving: false } }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Medal className="size-5 text-orange-500" />Grade Submissions
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            {challenge.title} · {challenge.points} pts max
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-5xl">📭</span>
            <p className="font-semibold text-stone-600 dark:text-stone-400">No submissions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => {
              const g = grading[s.id] ?? { score: "", feedback: "", saving: false };
              const isGraded = s.score !== null;
              return (
                <div key={s.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800/50">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">{s.student.firstName} {s.student.lastName}</p>
                      <p className="text-xs text-stone-400">{s.student.email}</p>
                    </div>
                    {isGraded && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Graded: {s.score}/{challenge.points}
                      </span>
                    )}
                  </div>
                  <div className="mb-3 space-y-1.5">
                    {s.linkUrl && (
                      <a href={s.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400">
                        <ExternalLink className="size-3.5" />{s.linkUrl}
                      </a>
                    )}
                    {s.fileUrl && (
                      <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400">
                        <FileUp className="size-3.5" />{s.fileName ?? "Download file"}
                      </a>
                    )}
                    {s.note && <p className="text-sm italic text-stone-600 dark:text-stone-400">&ldquo;{s.note}&rdquo;</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input type="number" min="0" max={challenge.points} placeholder={`Score (0–${challenge.points})`} className="h-8 w-32 text-sm"
                      value={g.score} onChange={(e) => setGrading((prev) => ({ ...prev, [s.id]: { ...prev[s.id], score: e.target.value } }))} />
                    <Input placeholder="Feedback (optional)" className="h-8 min-w-0 flex-1 text-sm"
                      value={g.feedback} onChange={(e) => setGrading((prev) => ({ ...prev, [s.id]: { ...prev[s.id], feedback: e.target.value } }))} />
                    <Button size="sm" className="h-8 gap-1.5 px-3 text-xs" disabled={g.saving} onClick={() => void saveGrade(s.id)}>
                      {g.saving ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                      {isGraded ? "Update" : "Grade"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Create Challenge Dialog ───────────────────────────────────────────────────

function CreateChallengeDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    programId: "", moduleId: "none", title: "", description: "",
    weekNumber: "", points: "100", dueDate: "", published: true,
  });

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/programs")
      .then((r) => r.ok ? r.json() as Promise<{ programs: Program[] }> : Promise.reject())
      .then((d) => setPrograms(d.programs ?? []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    set("moduleId", "none");
    if (!form.programId) { setModules([]); return; }
    fetch(`/api/programs/${form.programId}/modules`)
      .then((r) => r.ok ? r.json() as Promise<{ modules: Module[] }> : Promise.reject())
      .then((d) => setModules(d.modules ?? []))
      .catch(() => setModules([]));
  }, [form.programId, set]);

  async function handleSave() {
    if (!form.programId || !form.title.trim()) { toast.error("Please fill in the program and title."); return; }
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
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to create challenge");
        return;
      }
      toast.success(form.published ? "Challenge published! 🎉" : "Challenge saved as draft");
      onCreated(); onClose();
      setForm({ programId: "", moduleId: "none", title: "", description: "", weekNumber: "", points: "100", dueDate: "", published: true });
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
            <Flame className="size-5 text-orange-500" />New Weekly Challenge
          </DialogTitle>
          <DialogDescription>Create a challenge for a program module.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Program *</label>
            <Select value={form.programId} onValueChange={(v) => set("programId", v)}>
              <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent>{programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Module (optional)</label>
            <Select value={form.moduleId} onValueChange={(v) => set("moduleId", v)} disabled={!form.programId || modules.length === 0}>
              <SelectTrigger><SelectValue placeholder={modules.length === 0 ? "No modules yet" : "Select module"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">,  No specific module, </SelectItem>
                {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Challenge Title *</label>
            <Input placeholder="e.g. Build a Calculator App" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Description</label>
            <Textarea placeholder="Describe what students should build…" className="min-h-[70px] resize-y text-sm" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Week #</label>
            <Input type="number" min="1" placeholder="e.g. 3" value={form.weekNumber} onChange={(e) => set("weekNumber", e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Points</label>
            <Input type="number" min="1" value={form.points} onChange={(e) => set("points", e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Due Date</label>
            <DateInput value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>

          <div className="col-span-2">
            <button type="button" onClick={() => set("published", !form.published)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${form.published ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20" : "border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"}`}
            >
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${form.published ? "bg-emerald-100 dark:bg-emerald-800" : "bg-stone-100 dark:bg-stone-700"}`}>
                {form.published ? <Eye className="size-4 text-emerald-600 dark:text-emerald-400" /> : <EyeOff className="size-4 text-stone-400" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${form.published ? "text-emerald-700 dark:text-emerald-400" : "text-stone-600 dark:text-stone-400"}`}>
                  {form.published ? "Publish immediately" : "Save as draft"}
                </p>
                <p className="text-xs text-stone-400">
                  {form.published ? "Students will be notified and can start submitting." : "Only you can see this, publish it when ready."}
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <PlusCircle className="size-3.5" />}
            {saving ? "Saving…" : form.published ? "Publish Challenge" : "Save Draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Challenge Card ────────────────────────────────────────────────────────────

function ChallengeCard({ challenge, isLearner, onRefresh }: {
  challenge: Challenge; isLearner: boolean; onRefresh: () => void;
}) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const accent = accentFor(challenge.id);
  const due = dueMeta(challenge.dueDate);
  const mySubmission = challenge.submissions?.[0] ?? null;
  const submitted = !!mySubmission;
  const graded = mySubmission?.score !== null && mySubmission?.score !== undefined;
  const isActive = !due.ended;

  async function togglePublish() {
    setToggling(true);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !challenge.published }),
      });
      if (!res.ok) { toast.error("Failed to update challenge."); return; }
      toast.success(challenge.published ? "Challenge unpublished" : "Challenge published! Students notified 🎉");
      onRefresh();
    } catch {
      toast.error("Something went wrong.");
    } finally { setToggling(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${challenge.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete."); return; }
      toast.success("Challenge deleted.");
      onRefresh();
    } catch {
      toast.error("Something went wrong.");
    } finally { setDeleting(false); }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 border-l-4 ${accent} ${!challenge.published ? "opacity-70" : ""}`}
      >
        <div className="p-3 sm:p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {!challenge.published && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500 dark:bg-stone-800">Draft</span>
            )}
            {challenge.weekNumber && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                Week {challenge.weekNumber}
              </span>
            )}
            {challenge.module && (
              <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                {challenge.module.title}
              </span>
            )}
            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
              {challenge.program.name}
            </span>
            {isActive && due.urgent && (
              <span className="flex items-center gap-0.5 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <Flame className="size-3" />{due.label}
              </span>
            )}
          </div>

          <h3 className="font-semibold leading-snug text-stone-900 dark:text-stone-100">{challenge.title}</h3>
          {challenge.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">{challenge.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-400">
            <span className="flex items-center gap-1"><Star className="size-3.5 text-amber-400" />{challenge.points} pts</span>
            {due.ended && <span className="flex items-center gap-1"><Clock className="size-3.5" />Ended</span>}
            {!due.ended && !due.urgent && challenge.dueDate && (
              <span className="flex items-center gap-1"><Calendar className="size-3.5" />{due.label}</span>
            )}
            <span className="flex items-center gap-1"><Users className="size-3.5" />{challenge._count.submissions} submitted</span>
            {!isLearner && challenge.createdBy && (
              <span className="text-stone-300 dark:text-stone-600">by {challenge.createdBy.firstName}</span>
            )}
          </div>

          {isLearner && graded && mySubmission && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Your score: {mySubmission.score}/{challenge.points}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500">{rankTitle(mySubmission.score!, challenge.points)}</p>
              </div>
              <div className="h-2 w-16 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((mySubmission.score! / Math.max(challenge.points, 1)) * 100)}%` }} />
              </div>
            </div>
          )}
          {isLearner && submitted && !graded && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 dark:bg-orange-900/20">
              <CheckCircle2 className="size-4 shrink-0 text-orange-500" />
              <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Submitted, waiting to be graded ⏳</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-2.5 dark:border-stone-800 dark:bg-stone-800/30">
          <button onClick={() => setBoardOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-stone-500 transition hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400"
          >
            <Trophy className="size-3.5" />Leaderboard
          </button>

          {!isLearner && (
            <button onClick={() => setGradeOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-stone-500 transition hover:text-orange-600 dark:text-stone-400 dark:hover:text-orange-400"
            >
              <Medal className="size-3.5" />Grade ({challenge._count.submissions})
            </button>
          )}

          <div className="flex-1" />

          {!isLearner && (
            <>
              <button onClick={() => void togglePublish()} disabled={toggling}
                className={`flex items-center gap-1 text-xs font-medium transition ${challenge.published ? "text-stone-400 hover:text-orange-500" : "text-emerald-500 hover:text-emerald-600"}`}
              >
                {toggling ? <Loader2 className="size-3.5 animate-spin" /> : challenge.published ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {challenge.published ? "Unpublish" : "Publish"}
              </button>
              <button onClick={() => void handleDelete()} disabled={deleting}
                className="flex items-center gap-1 text-xs font-medium text-stone-400 transition hover:text-red-500"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </button>
            </>
          )}

          {isLearner && challenge.published && isActive && !submitted && (
            <Button size="sm" onClick={() => setSubmitOpen(true)} className="h-7 gap-1.5 px-3 text-xs">
              <Zap className="size-3.5" />Enter Challenge
            </Button>
          )}
        </div>
      </motion.div>

      {isLearner && <SubmitDialog challenge={challenge} open={submitOpen} onClose={() => setSubmitOpen(false)} onSubmitted={onRefresh} />}
      {!isLearner && <GradeSubmissionsDialog challenge={challenge} open={gradeOpen} onClose={() => setGradeOpen(false)} />}
      <LeaderboardDialog challenge={challenge} open={boardOpen} onClose={() => setBoardOpen(false)} />
    </>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ChallengesPanel({ role }: { role: UserRoleValue }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "draft" | "past">("active");
  const [createOpen, setCreateOpen] = useState(false);

  const isLearner = LEARNER_ROLES.includes(role);
  const isManager = MANAGER_ROLES.includes(role);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/challenges");
      if (!res.ok) throw new Error();
      const data = await res.json() as { challenges: Challenge[] };
      setChallenges(data.challenges ?? []);
    } catch {
      toast.error("Could not load challenges");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const now = Date.now();
  const active = challenges.filter((c) => c.published && (!c.dueDate || new Date(c.dueDate).getTime() > now));
  const past = challenges.filter((c) => c.published && c.dueDate && new Date(c.dueDate).getTime() <= now);
  const drafts = challenges.filter((c) => !c.published);

  const tabs: [string, Challenge[]][] = isLearner
    ? [["active", active]]
    : [["active", active], ["draft", drafts], ["past", past]];

  const displayed = tab === "active" ? active : tab === "draft" ? drafts : past;
  const featured = active.find((c) => c.dueDate) ?? active[0] ?? null;

  return (
    <div className="space-y-5">
      <AnimatePresence>
        {isLearner && featured && (
          <motion.div key={featured.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1714] via-[#B2401D] to-orange-600 px-4 py-5 sm:px-6 sm:py-6 text-white"
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
              <div className="absolute -bottom-8 left-10 h-32 w-32 rounded-full bg-orange-300/10 blur-2xl" />
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">This Week&apos;s Challenge</span>
                  {featured.weekNumber && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium">Week {featured.weekNumber}</span>}
                </div>
                <h2 className="text-lg font-bold leading-snug sm:text-xl">{featured.title}</h2>
                {featured.module && <p className="mt-0.5 text-sm text-orange-200">{featured.module.title}</p>}
                {featured.dueDate && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-orange-200">
                    <Clock className="size-3.5" />{dueMeta(featured.dueDate).label}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
                  <Star className="size-4 text-amber-300" />{featured.points} pts
                </div>
                <div className="flex items-center gap-1.5 text-xs text-orange-200">
                  <Users className="size-3.5" />{featured._count.submissions} on the board
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
          {tabs.map(([t, list]) => (
            <button key={t} onClick={() => setTab(t as typeof tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors sm:px-4 sm:text-sm ${tab === t ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100" : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"}`}
            >
              {t}{list.length > 0 ? ` (${list.length})` : ""}
            </button>
          ))}
        </div>
        {isManager && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0 gap-1.5">
            <PlusCircle className="size-3.5" />
            <span className="hidden sm:inline">New Challenge</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-200 py-16 text-center dark:border-stone-700">
          <span className="text-5xl">{tab === "active" ? "🚀" : tab === "draft" ? "📝" : "📚"}</span>
          <p className="font-medium text-stone-600 dark:text-stone-400">
            {tab === "active" ? "No active challenges right now" : tab === "draft" ? "No drafts" : "No past challenges yet"}
          </p>
          {isManager && tab === "active" && (
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="mt-1 gap-1.5">
              <PlusCircle className="size-3.5" />Create one
            </Button>
          )}
          {isLearner && tab === "active" && (
            <p className="text-sm text-stone-400">Check back soon, a new challenge is coming! 💪</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {displayed.map((c) => (
            <ChallengeCard key={c.id} challenge={c} isLearner={isLearner} onRefresh={() => void load()} />
          ))}
        </div>
      )}

      <CreateChallengeDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
    </div>
  );
}
