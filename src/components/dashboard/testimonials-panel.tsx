"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, MessageSquare, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type TestimonialStatus = "PENDING" | "APPROVED" | "REJECTED";
type ReviewAction = "approve" | "reject" | "feature" | "unfeature";

type Testimonial = {
  id: string;
  quote: string;
  rating: number;
  childName: string | null;
  status: TestimonialStatus;
  featuredOnPage: boolean;
  rejectionNote: string | null;
  submittedAt: string;
  author?: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  reviewedBy?: { firstName: string; lastName: string } | null;
};

// ── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<TestimonialStatus, string> = {
  PENDING:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function StarRating({ rating, interactive = false, onChange }: {
  rating: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={[
            "size-4 transition-colors",
            (hover || rating) >= s
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-slate-300 dark:text-slate-600",
            interactive ? "cursor-pointer" : "",
          ].join(" ")}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onChange?.(s)}
        />
      ))}
    </div>
  );
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ── Admin sub-components (must be top-level to satisfy react-hooks/static-components) ──

type TestimonialCardProps = {
  t: Testimonial;
  busy: string | null;
  onAction: (id: string, act: ReviewAction) => void;
  onRejectOpen: (t: Testimonial) => void;
  onDeleteOpen: (t: Testimonial) => void;
};

function TestimonialCard({ t, busy, onAction, onRejectOpen, onDeleteOpen }: TestimonialCardProps) {
  const isBusy = busy === t.id;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="kat-card space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {t.author && (
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "var(--kat-gradient)" }}
            >
              {getInitials(t.author.firstName, t.author.lastName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {t.author ? `${t.author.firstName} ${t.author.lastName}` : "Unknown"}
            </p>
            {t.childName && (
              <p className="text-xs text-slate-500 dark:text-slate-400">re: {t.childName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[t.status]}`}>
            {t.status}
          </span>
          {t.featuredOnPage && t.status === "APPROVED" && (
            <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              Featured
            </span>
          )}
        </div>
      </div>

      {/* Quote */}
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 italic">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <StarRating rating={t.rating} />
        <span className="text-xs text-slate-400">
          {new Date(t.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      {t.rejectionNote && (
        <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-lg px-3 py-2">
          Rejection note: {t.rejectionNote}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {t.status === "PENDING" && (
          <>
            <Button
              size="sm"
              className="kat-btn-primary h-8 text-xs"
              disabled={isBusy}
              onClick={() => onAction(t.id, "approve")}
            >
              {isBusy ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
              disabled={isBusy}
              onClick={() => onRejectOpen(t)}
            >
              <X className="size-3 mr-1" />
              Reject
            </Button>
          </>
        )}
        {t.status === "APPROVED" && (
          <>
            {t.featuredOnPage ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={isBusy}
                onClick={() => onAction(t.id, "unfeature")}
              >
                {isBusy && <Loader2 className="size-3 animate-spin mr-1" />}
                Unfeature
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-sky-300 text-sky-600 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400"
                disabled={isBusy}
                onClick={() => onAction(t.id, "feature")}
              >
                {isBusy && <Loader2 className="size-3 animate-spin mr-1" />}
                Feature
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
              disabled={isBusy}
              onClick={() => onRejectOpen(t)}
            >
              <X className="size-3 mr-1" />
              Reject
            </Button>
          </>
        )}
        {t.status === "REJECTED" && (
          <Button
            size="sm"
            className="kat-btn-primary h-8 text-xs"
            disabled={isBusy}
            onClick={() => onAction(t.id, "approve")}
          >
            {isBusy ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
            Approve
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 ml-auto"
          disabled={isBusy}
          onClick={() => onDeleteOpen(t)}
        >
          <Trash2 className="size-3 mr-1" />
          Delete
        </Button>
      </div>
    </motion.div>
  );
}

type SectionProps = {
  title: string;
  items: Testimonial[];
  busy: string | null;
  onAction: (id: string, act: ReviewAction) => void;
  onRejectOpen: (t: Testimonial) => void;
  onDeleteOpen: (t: Testimonial) => void;
};

function TestimonialSection({ title, items, busy, onAction, onRejectOpen, onDeleteOpen }: SectionProps) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {title}{" "}
        <span className="ml-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs">
          {items.length}
        </span>
      </h3>
      <AnimatePresence>
        {items.map((t) => (
          <TestimonialCard
            key={t.id}
            t={t}
            busy={busy}
            onAction={onAction}
            onRejectOpen={onRejectOpen}
            onDeleteOpen={onDeleteOpen}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── PARENT VIEW ───────────────────────────────────────────────────────────────

export function ParentTestimonialsPanel() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState(5);
  const [childName, setChildName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/testimonials?scope=mine");
    if (res.ok) {
      const data = await res.json() as { testimonials: Testimonial[] };
      setTestimonials(data.testimonials ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const existing = testimonials[0] ?? null;
  const canSubmit = !existing || existing.status === "REJECTED";

  const submit = async () => {
    if (quote.trim().length < 20) {
      toast.error("Please write at least 20 characters.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote: quote.trim(), rating, childName: childName.trim() || undefined }),
    });
    const data = await res.json() as { error?: string };
    setSubmitting(false);
    if (!res.ok) { toast.error(data.error ?? "Could not submit testimonial."); return; }
    toast.success("Testimonial submitted! Our team will review it shortly.");
    setQuote(""); setRating(5); setChildName("");
    await load();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {existing && (
          <motion.div
            key={existing.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="kat-card space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[existing.status]}`}>
                    {existing.status}
                  </span>
                  {existing.featuredOnPage && existing.status === "APPROVED" && (
                    <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                      Featured
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 italic">
                  &ldquo;{existing.quote}&rdquo;
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <StarRating rating={existing.rating} />
                  {existing.childName && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">re: {existing.childName}</span>
                  )}
                </div>
                {existing.rejectionNote && (
                  <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                    Note from reviewer: {existing.rejectionNote}
                  </p>
                )}
              </div>
            </div>
            {existing.status === "REJECTED" && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can submit a revised testimonial below.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {canSubmit && (
        <div className="kat-card space-y-5">
          <div>
            <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-800 dark:text-slate-200">
              {existing?.status === "REJECTED" ? "Submit a revised testimonial" : "Share your experience"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tell us about your child&apos;s journey with KAT. Approved testimonials may appear on our website.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Rating
            </label>
            <StarRating rating={rating} interactive onChange={setRating} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Child&apos;s first name <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={50}
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="e.g. Temi"
              className="w-full rounded-xl border border-[var(--kat-border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--kat-primary-blue)]/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Your testimonial
            </label>
            <Textarea
              rows={4}
              maxLength={600}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Share how KAT has impacted your child's learning journey…"
              className="resize-none rounded-xl border-[var(--kat-border)] text-sm"
            />
            <p className="text-right text-xs text-slate-400">{quote.length}/600</p>
          </div>

          <Button
            onClick={submit}
            disabled={submitting || quote.trim().length < 20}
            className="kat-btn-primary w-full sm:w-auto"
          >
            {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <MessageSquare className="size-4 mr-2" />}
            {submitting ? "Submitting…" : "Submit testimonial"}
          </Button>
        </div>
      )}

      {!canSubmit && existing && (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
          {existing.status === "PENDING"
            ? "Your testimonial is under review. You'll be notified once it's been assessed."
            : "Your testimonial is live on our website. Thank you!"}
        </p>
      )}
    </div>
  );
}

// ── SUPER-ADMIN VIEW ──────────────────────────────────────────────────────────

export function AdminTestimonialsPanel() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<Testimonial | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/testimonials?scope=admin");
    if (res.ok) {
      const data = await res.json() as { testimonials: Testimonial[] };
      setTestimonials(data.testimonials ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleAction = async (testimonialId: string, act: ReviewAction, note?: string) => {
    setBusy(testimonialId);
    const res = await fetch(`/api/testimonials/${testimonialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act, rejectionNote: note }),
    });
    const data = await res.json() as { error?: string };
    setBusy(null);
    if (!res.ok) { toast.error(data.error ?? "Action failed."); return; }
    const labels: Record<ReviewAction, string> = {
      approve: "Testimonial approved and featured.",
      reject: "Testimonial rejected.",
      feature: "Testimonial is now featured.",
      unfeature: "Testimonial removed from featured.",
    };
    toast.success(labels[act]);
    await load();
  };

  const handleRejectOpen = (t: Testimonial) => {
    setRejectTarget(t);
    setRejectionNote("");
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    await handleAction(rejectTarget.id, "reject", rejectionNote.trim() || undefined);
    setRejecting(false);
    setRejectTarget(null);
    setRejectionNote("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/testimonials/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json() as { error?: string };
    setDeleting(false);
    if (!res.ok) { toast.error(data.error ?? "Delete failed."); return; }
    toast.success("Testimonial deleted.");
    setDeleteTarget(null);
    await load();
  };

  const pending  = testimonials.filter((t) => t.status === "PENDING");
  const approved = testimonials.filter((t) => t.status === "APPROVED");
  const rejected = testimonials.filter((t) => t.status === "REJECTED");

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (testimonials.length === 0) {
    return (
      <div className="kat-card py-12 text-center text-slate-500 dark:text-slate-400">
        <MessageSquare className="mx-auto mb-3 size-8 opacity-40" />
        <p className="text-sm">No testimonials yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <TestimonialSection
          title="Pending Review"
          items={pending}
          busy={busy}
          onAction={handleAction}
          onRejectOpen={handleRejectOpen}
          onDeleteOpen={setDeleteTarget}
        />
        <TestimonialSection
          title="Approved"
          items={approved}
          busy={busy}
          onAction={handleAction}
          onRejectOpen={handleRejectOpen}
          onDeleteOpen={setDeleteTarget}
        />
        <TestimonialSection
          title="Rejected"
          items={rejected}
          busy={busy}
          onAction={handleAction}
          onRejectOpen={handleRejectOpen}
          onDeleteOpen={setDeleteTarget}
        />
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject testimonial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Optionally leave a note for the parent explaining why.
            </p>
            <Textarea
              rows={3}
              maxLength={500}
              placeholder="Reason (optional)…"
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              className="resize-none rounded-xl text-sm"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>
                Cancel
              </Button>
              <Button
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={handleReject}
                disabled={rejecting}
              >
                {rejecting && <Loader2 className="size-4 animate-spin mr-2" />}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete testimonial?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400 pt-2">
            This is permanent and cannot be undone. The parent will not be notified.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
