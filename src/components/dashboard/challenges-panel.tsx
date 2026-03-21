"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import type { AssessmentTypeValue, UserRoleValue } from "@/lib/enums";

// ── Types ───────────────────────────────────────────────────────────────────

type Program = { id: string; name: string };
type Module = { id: string; title: string };
type Question = { id: string; prompt: string; type: string; points: number };

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  weekNumber: number | null;
  totalPoints: number;
  passScore: number;
  dueDate: string | null;
  published: boolean;
  verificationStatus: string;
  program: Program;
  module: Module | null;
  questions: Question[];
  submissions: { id: string; status: string; totalScore: number; submittedAt: string; attemptNumber: number }[];
  _count: { submissions: number };
};

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  score: number;
  totalPoints: number;
  submittedAt: string;
  isCurrentUser: boolean;
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

const RANK_TITLE = (score: number, total: number): string => {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 1) return "Perfect Score! 🌟";
  if (pct >= 0.9) return "Code Wizard 🧙";
  if (pct >= 0.75) return "Bug Slayer ⚔️";
  if (pct >= 0.6) return "Loop Master 🔄";
  return "Rising Star ✨";
};

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

// ── Leaderboard ──────────────────────────────────────────────────────────────

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
  const [loading, setLoading] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/challenges/leaderboard?assessmentId=${challenge.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { leaderboard: LeaderboardEntry[]; currentUserRank: number | null }) => {
        setEntries(d.leaderboard);
        setCurrentUserRank(d.currentUserRank);
      })
      .catch(() => toast.error("Could not load leaderboard"))
      .finally(() => setLoading(false));
  }, [open, challenge.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            Challenge Champions
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {challenge.title} · {challenge._count.submissions} participant{challenge._count.submissions !== 1 ? "s" : ""}
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
            <p className="font-medium text-slate-600 dark:text-slate-400">No submissions yet</p>
            <p className="text-sm text-slate-400">Be the first on the board!</p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {currentUserRank && currentUserRank > 5 && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                You&apos;re ranked #{currentUserRank} — keep going! 💪
              </p>
            )}

            {/* Top 3 podium */}
            {entries.length >= 3 && (
              <div className="mb-4 flex items-end justify-center gap-3 pt-2">
                {/* 2nd */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">🥈</span>
                  <div className="flex h-16 w-20 items-end justify-center rounded-t-xl bg-slate-200 dark:bg-slate-700 pb-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {entries[1]?.firstName}
                  </div>
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl">🥇</span>
                  <div className="flex h-24 w-24 items-end justify-center rounded-t-xl bg-amber-300 dark:bg-amber-600 pb-2 text-center text-sm font-bold text-amber-900 dark:text-amber-100">
                    {entries[0]?.firstName}
                  </div>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">🥉</span>
                  <div className="flex h-12 w-20 items-end justify-center rounded-t-xl bg-orange-200 dark:bg-orange-800 pb-2 text-center text-xs font-semibold text-orange-800 dark:text-orange-200">
                    {entries[2]?.firstName}
                  </div>
                </div>
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
                {/* Rank */}
                <span className="w-6 text-center text-base">
                  {e.rank <= 3 ? MEDAL[e.rank] : <span className="text-xs font-bold text-slate-400">#{e.rank}</span>}
                </span>

                {/* Avatar initial */}
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-[11px] font-bold text-white">
                  {e.firstName.charAt(0).toUpperCase()}
                  {e.lastName.charAt(0).toUpperCase()}
                </div>

                {/* Name + title */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {e.firstName} {e.isCurrentUser ? "(You)" : ""}
                  </p>
                  <p className="text-[10px] text-slate-400">{RANK_TITLE(e.score, e.totalPoints)}</p>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {e.score}
                    <span className="text-[10px] font-normal text-slate-400">/{e.totalPoints}</span>
                  </p>
                  {/* Score bar */}
                  <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-500 transition-all"
                      style={{ width: `${Math.round((e.score / Math.max(e.totalPoints, 1)) * 100)}%` }}
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (challenge.questions.some((q) => !answers[q.id]?.trim())) {
      toast.error("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/assessments/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: challenge.id,
          answers: challenge.questions.map((q) => ({ questionId: q.id, value: answers[q.id] ?? "" })),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Submission failed");
        return;
      }

      toast.success("Challenge submitted! 🎉 Check the leaderboard!");
      onSubmitted();
      onClose();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasSubmission = challenge.submissions.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="size-5 text-orange-500" />
            {hasSubmission ? "Resubmit Challenge" : "Enter the Challenge!"}
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

        <div className="space-y-4">
          {challenge.questions.map((q, i) => (
            <div key={q.id}>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {i + 1}. {q.prompt}
                <span className="ml-1.5 text-xs font-normal text-slate-400">({q.points} pts)</span>
              </label>
              <Textarea
                placeholder="Type your answer here…"
                className="min-h-[80px] resize-y text-sm"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            {submitting ? "Submitting…" : hasSubmission ? "Resubmit" : "Submit Challenge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
    moduleId: "",
    title: "",
    description: "",
    weekNumber: "",
    totalPoints: "100",
    passScore: "50",
    dueDate: "",
    prompt: "Share your work — paste a link, describe what you built, or show your code.",
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/programs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { programs: Program[] }) => setPrograms(d.programs ?? []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!form.programId) { setModules([]); return; }
    fetch(`/api/programs/${form.programId}/modules`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { modules: Module[] }) => setModules(d.modules ?? []))
      .catch(() => setModules([]));
  }, [form.programId]);

  function set(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    if (!form.programId || !form.title.trim() || !form.prompt.trim()) {
      toast.error("Please fill in program, title, and the challenge question.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: form.programId,
          moduleId: form.moduleId || null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          type: "CHALLENGE" as AssessmentTypeValue,
          weekNumber: form.weekNumber ? parseInt(form.weekNumber, 10) : null,
          totalPoints: parseInt(form.totalPoints, 10) || 100,
          passScore: parseInt(form.passScore, 10) || 50,
          dueDate: form.dueDate || null,
          published: true,
          questions: [
            {
              prompt: form.prompt.trim(),
              type: "OPEN_ENDED",
              points: parseInt(form.totalPoints, 10) || 100,
              options: [],
            },
          ],
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="size-5 text-orange-500" />
            New Weekly Challenge
          </DialogTitle>
          <DialogDescription>Create a challenge for a program module. Students can submit and compete on the leaderboard.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              <Select value={form.moduleId} onValueChange={(v) => set("moduleId", v)} disabled={!form.programId || modules.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={modules.length === 0 ? "No modules yet" : "Select module"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No specific module —</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Challenge Title *</label>
              <Input placeholder="e.g. Build a Calculator App" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
              <Textarea
                placeholder="Describe the challenge and what students should build…"
                className="min-h-[70px] resize-y text-sm"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Week #</label>
              <Input type="number" min="1" placeholder="e.g. 3" value={form.weekNumber} onChange={(e) => set("weekNumber", e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Due Date</label>
              <DateInput value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Total Points</label>
              <Input type="number" min="1" value={form.totalPoints} onChange={(e) => set("totalPoints", e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Pass Score</label>
              <Input type="number" min="0" value={form.passScore} onChange={(e) => set("passScore", e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Submission Prompt *</label>
              <Textarea
                placeholder="What should students submit?"
                className="min-h-[60px] resize-y text-sm"
                value={form.prompt}
                onChange={(e) => set("prompt", e.target.value)}
              />
            </div>
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

  const accent = accentColor(challenge.id);
  const due = formatDue(challenge.dueDate);
  const mySubmission = challenge.submissions[0] ?? null;
  const submitted = !!mySubmission;
  const graded = mySubmission?.status === "GRADED";
  const active = isActive(challenge);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 border-l-4 ${accent}`}
      >
        <div className="p-4">
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
              {challenge.totalPoints} pts
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

          {/* My result (if graded) */}
          {graded && mySubmission && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Your score: {mySubmission.totalScore}/{challenge.totalPoints}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
                  {RANK_TITLE(mySubmission.totalScore, challenge.totalPoints)}
                </p>
              </div>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((mySubmission.totalScore / Math.max(challenge.totalPoints, 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Submitted but not yet graded */}
          {submitted && !graded && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
              <CheckCircle2 className="size-4 shrink-0 text-blue-500" />
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Submitted — waiting to be graded</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/30">
          <button
            onClick={() => setBoardOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
          >
            <Trophy className="size-3.5" />
            Leaderboard
          </button>

          <div className="flex-1" />

          {isLearner && active && (
            <Button
              size="sm"
              variant={submitted ? "outline" : "default"}
              onClick={() => setSubmitOpen(true)}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              {submitted ? (
                <>
                  <ChevronRight className="size-3" />
                  Resubmit
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Enter Challenge
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>

      <SubmitDialog
        challenge={challenge}
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={onRefresh}
      />
      <LeaderboardDialog
        challenge={challenge}
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
      />
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
      const res = await fetch("/api/challenges/weekly");
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

  // Featured challenge (first active with a due date or just first active)
  const featured = active.find((c) => c.dueDate) ?? active[0] ?? null;

  return (
    <div className="space-y-5">
      {/* ── Hero banner for active featured challenge (learners only) ── */}
      <AnimatePresence>
        {isLearner && featured && (
          <motion.div
            key={featured.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1F45] via-[#1E5FAF] to-violet-600 px-6 py-6 text-white"
          >
            {/* Background blobs */}
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
                <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold leading-snug">
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
                  {featured.totalPoints} pts
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
      <div className="flex items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["active", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t === "active" ? `Active${active.length > 0 ? ` (${active.length})` : ""}` : `Past${past.length > 0 ? ` (${past.length})` : ""}`}
            </button>
          ))}
        </div>

        {isManager && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <PlusCircle className="size-3.5" />
            New Challenge
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
              Create one
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
