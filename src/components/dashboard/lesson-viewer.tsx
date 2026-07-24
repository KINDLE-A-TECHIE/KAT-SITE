"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ExternalLink,
  FileText, Link as LinkIcon, Network, Plus, Sparkles,
  Terminal, Video, Youtube, XCircle,
} from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ContentCreateForm } from "@/components/dashboard/content-create-form";
import { CodePlaygroundBlock } from "@/components/dashboard/code-playground-block";
import { NetworkLabBlock } from "@/components/network-lab/network-lab-block";

export type ContentItem = {
  id: string;
  type: "RICH_TEXT" | "YOUTUBE_EMBED" | "EXTERNAL_VIDEO" | "DOCUMENT_LINK" | "CODE_PLAYGROUND" | "NETWORK_LAB";
  title: string;
  body: string | null;
  url: string | null;
  language: string | null;
  sortOrder: number;
  reviewStatus: "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
  reviewNote: string | null;
  createdBy: { firstName: string; lastName: string };
};

type LessonNav = { id: string; title: string } | null;

type LessonData = {
  id: string;
  title: string;
  description: string | null;
  isSample: boolean;
  contents: ContentItem[];
  module: {
    id: string;
    title: string;
    version: {
      id: string;
      versionNumber: number;
      label: string;
      curriculum: { program: { id: string; name: string } };
    };
  };
};

const CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

const TYPE_CONFIG = {
  RICH_TEXT:       { label: "Reading",     Icon: FileText },
  YOUTUBE_EMBED:   { label: "Video",       Icon: Youtube },
  EXTERNAL_VIDEO:  { label: "Video",       Icon: Video },
  DOCUMENT_LINK:   { label: "Resource",    Icon: LinkIcon },
  CODE_PLAYGROUND: { label: "Try it",      Icon: Terminal },
  NETWORK_LAB:     { label: "Network Lab", Icon: Network },
} as const;

const REVIEW_STYLE = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  PUBLISHED:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  REJECTED:       "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "onfocus", "oninput"],
  });
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.)/, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] ?? null;
    if (host === "youtube.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] ?? null;
    }
    return null;
  } catch { return null; }
}

function extractVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      return id && /^\d+$/.test(id) ? id : null;
    }
    return null;
  } catch { return null; }
}

function VideoEmbed({ url, title }: { url: string; title: string }) {
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg shadow-md">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
    );
  }
  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg shadow-md">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
    );
  }
  return (
    <video controls className="w-full rounded-lg shadow-md" src={url}>
      <track kind="captions" />
      Your browser does not support the video tag.
    </video>
  );
}

/**
 * Renders the body of one content block. Shared by the learner player (one
 * step at a time), the creator outline (stacked), and the school teacher preview,
 * so the views can never drift in what they can display.
 */
export function ContentBody({
  content,
  isCreator,
  userId,
  programId,
  moduleId,
  onLabComplete,
}: {
  content: ContentItem;
  isCreator: boolean;
  userId?: string;
  programId?: string;
  moduleId?: string;
  onLabComplete?: () => void;
}) {
  return (
    <>
      {content.type === "RICH_TEXT" && content.body && (
        <div
          className="prose prose-stone dark:prose-invert mx-auto max-w-3xl text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.body) }}
        />
      )}

      {(content.type === "YOUTUBE_EMBED" || content.type === "EXTERNAL_VIDEO") && content.url && (
        <VideoEmbed url={content.url} title={content.title} />
      )}

      {content.type === "DOCUMENT_LINK" && content.url && (
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50 p-3 transition hover:border-orange-200 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 sm:gap-4 sm:p-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/50 sm:h-12 sm:w-12">
            <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-orange-900 dark:text-orange-100">{content.title}</p>
            <p className="mt-0.5 truncate text-xs text-orange-500 dark:text-orange-400">{content.url}</p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-orange-400 transition group-hover:text-orange-600 dark:group-hover:text-orange-300" />
        </a>
      )}

      {content.type === "CODE_PLAYGROUND" && content.language && (
        <CodePlaygroundBlock
          contentId={content.id}
          starterCode={content.body ?? ""}
          language={content.language}
          isCreator={isCreator}
          userId={userId}
          programId={programId}
          moduleId={moduleId}
        />
      )}

      {content.type === "NETWORK_LAB" && content.body && (
        <NetworkLabBlock levelKey={content.body} onComplete={onLabComplete} />
      )}
    </>
  );
}

/** Creator outline block: full chrome, review controls, stacked view only. */
function ReviewBlock({
  content,
  index,
  total,
  isSA,
  userId,
  programId,
  moduleId,
  onReview,
}: {
  content: ContentItem;
  index: number;
  total: number;
  isSA: boolean;
  userId?: string;
  programId?: string;
  moduleId?: string;
  onReview: (id: string, action: "PUBLISH" | "REJECT", note?: string) => Promise<void>;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cfg = TYPE_CONFIG[content.type];
  const { Icon } = cfg;

  const review = async (action: "PUBLISH" | "REJECT") => {
    setBusy(true);
    await onReview(content.id, action, action === "REJECT" ? rejectNote : undefined);
    setBusy(false);
    setShowReject(false);
    setRejectNote("");
  };

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-stone-400" />
          <p className="truncate font-semibold text-stone-900 dark:text-stone-100">{content.title}</p>
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-stone-400">
            {cfg.label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${REVIEW_STYLE[content.reviewStatus]}`}>
            {content.reviewStatus.replace("_", " ")}
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">{index + 1}/{total}</span>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <ContentBody
          content={content}
          isCreator
          userId={userId}
          programId={programId}
          moduleId={moduleId}
        />
      </div>

      {content.reviewNote && content.reviewStatus === "REJECTED" && (
        <div className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          <strong>Rejection note:</strong> {content.reviewNote}
        </div>
      )}

      {isSA && content.reviewStatus === "PENDING_REVIEW" && (
        <div className="border-t border-stone-100 px-5 py-3 dark:border-stone-800">
          {!showReject ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void review("PUBLISH")}
                className="gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Publish
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowReject(true)}
                className="gap-1.5 border-rose-200 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Reason for rejection (optional)…"
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => void review("REJECT")}
                  className="gap-1.5 bg-rose-600 text-xs hover:bg-rose-700">
                  Confirm Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LessonViewer({
  lessonId,
  programId,
  role,
  userId,
  // Where "back to course" and prev/next lessons point. Defaults to the B2C curriculum routes.
  // The school learner surface passes its own (/learn, /learn/lessons) so a pupil never leaves the
  // school shell into a B2C page. Must be plain strings: this is a client component rendered by a
  // server component, which cannot pass functions.
  backHref = `/dashboard/curriculum/${programId}`,
  lessonBasePath = `/dashboard/curriculum/${programId}/lessons`,
}: {
  lessonId: string;
  programId: string;
  role: string;
  userId?: string;
  backHref?: string;
  lessonBasePath?: string;
}) {
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [prevLesson, setPrevLesson] = useState<LessonNav>(null);
  const [nextLesson, setNextLesson] = useState<LessonNav>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddContent, setShowAddContent] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const completionFired = useRef(false);

  // The learner's position. step === contents.length is the completion step.
  const [step, setStep] = useState(0);

  const isCreator = CREATOR_ROLES.includes(role);
  const isSA = role === "SUPER_ADMIN";

  const load = async () => {
    try {
      const res = await fetch(`/api/curriculum/lessons/${lessonId}`);
      if (res.ok) {
        const data = await res.json() as {
          lesson: LessonData;
          prevLesson: LessonNav;
          nextLesson: LessonNav;
          isCompleted: boolean;
        };
        setLesson(data.lesson);
        setPrevLesson(data.prevLesson);
        setNextLesson(data.nextLesson);
        setIsCompleted(data.isCompleted);
        setIsSample(data.lesson.isSample);
        completionFired.current = data.isCompleted; // don't re-fire if already done
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset position when navigating to a different lesson
  useEffect(() => { setStep(0); }, [lessonId]);

  // Completion is EARNED: it fires when the learner reaches the final step by
  // stepping through the lesson (or wins the network lab). Never on page load.
  const markComplete = async () => {
    if (isCreator || completionFired.current) return;
    completionFired.current = true;
    try {
      const res = await fetch(`/api/curriculum/lessons/${lessonId}/complete`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { completed: boolean; badgeEarned: { name: string; icon: string } | null };
        setIsCompleted(true);
        if (data.badgeEarned) {
          toast.success(`${data.badgeEarned.icon} Badge earned: ${data.badgeEarned.name}!`, {
            duration: 5000,
            description: "You completed all lessons in this module.",
          });
        }
      }
    } catch { /* ignore */ }
  };

  // Sample toggle (creators only). A sample lesson is previewable by a school's staff on a term they
  // have not licensed yet, so they can evaluate it before buying. Pupils never see samples.
  const toggleSample = async () => {
    const next = !isSample;
    setSampleBusy(true);
    setIsSample(next); // optimistic
    try {
      const res = await fetch(`/api/curriculum/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSample: next }),
      });
      if (!res.ok) {
        setIsSample(!next); // revert
        toast.error("Could not update the sample setting.");
      }
    } catch {
      setIsSample(!next);
      toast.error("Could not update the sample setting.");
    } finally {
      setSampleBusy(false);
    }
  };

  const reviewContent = async (contentId: string, action: "PUBLISH" | "REJECT", note?: string) => {
    const res = await fetch(`/api/curriculum/contents/${contentId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) {
      toast.success(action === "PUBLISH" ? "Content published!" : "Content rejected.");
      await load();
    } else {
      toast.error("Failed to update review status.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="rounded-lg border border-dashed border-stone-200 py-16 text-center dark:border-stone-800">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-stone-300 dark:text-stone-600" />
        <p className="font-medium text-stone-500 dark:text-stone-400">Lesson not found or you don&apos;t have access.</p>
        <Link href={backHref}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-kat-clay hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to course
        </Link>
      </div>
    );
  }

  const program = lesson.module.version.curriculum.program;
  const visibleContents = isCreator
    ? lesson.contents
    : lesson.contents.filter((c) => c.reviewStatus === "PUBLISHED");

  /* ── Creator outline: everything at once, with review chrome ─────────── */
  if (isCreator) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="border-b border-stone-200 pb-4 dark:border-stone-800">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition hover:text-kat-clay dark:text-stone-400"
          >
            <ArrowLeft className="h-3 w-3" />
            {program.name}
          </Link>
          <p className="mt-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
            {lesson.module.title}
          </p>
          <h1 className="mt-1 font-display text-xl font-bold leading-snug text-stone-900 dark:text-stone-100 sm:text-2xl">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="mt-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400">{lesson.description}</p>
          )}
          <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
            {visibleContents.length} block{visibleContents.length !== 1 ? "s" : ""} · learners see published blocks one step at a time
          </p>

          {/* Sample toggle: schools may preview a sample lesson on a term they have not licensed. */}
          <button
            type="button"
            onClick={toggleSample}
            disabled={sampleBusy}
            aria-pressed={isSample}
            className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              isSample
                ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400"
                : "border-stone-200 text-stone-500 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-800/40"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isSample ? "Sample lesson" : "Mark as sample"}
          </button>
          <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
            A sample is previewable by a school&apos;s staff before they license its term. Pupils never see samples.
          </p>
        </header>

        {visibleContents.length === 0 && !showAddContent && (
          <div className="rounded-lg border border-dashed border-stone-200 py-16 text-center dark:border-stone-800">
            <p className="font-medium text-stone-600 dark:text-stone-400">No content yet, add your first block below.</p>
          </div>
        )}

        <div className="space-y-4">
          {visibleContents.map((content, i) => (
            <ReviewBlock
              key={content.id}
              content={content}
              index={i}
              total={visibleContents.length}
              isSA={isSA}
              userId={userId}
              programId={programId}
              moduleId={lesson.module.id}
              onReview={reviewContent}
            />
          ))}
        </div>

        <AnimatePresence>
          {showAddContent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-lg border border-kat-clay/30 bg-orange-50/40 p-5 dark:bg-orange-950/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-stone-800 dark:text-stone-200">Add Content Block</h3>
                <button
                  onClick={() => setShowAddContent(false)}
                  className="text-xs text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
                >
                  Cancel
                </button>
              </div>
              <ContentCreateForm
                lessonId={lessonId}
                onSuccess={async () => { setShowAddContent(false); await load(); }}
              />
            </motion.div>
          ) : (
            <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-lg border-dashed border-kat-clay/40 py-6 text-kat-clay hover:bg-orange-50 dark:hover:bg-orange-950/20"
                onClick={() => setShowAddContent(true)}
              >
                <Plus className="h-4 w-4" />
                Add Content Block
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ── Learner player: one step per screen ──────────────────────────────── */
  const totalSteps = visibleContents.length;
  const onCompletionStep = step >= totalSteps;

  const goTo = (next: number) => {
    if (next >= totalSteps) void markComplete();
    setStep(Math.max(0, Math.min(next, totalSteps)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (totalSteps === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition hover:text-kat-clay dark:text-stone-400"
        >
          <ArrowLeft className="h-3 w-3" /> {program.name}
        </Link>
        <div className="mt-4 rounded-lg border border-dashed border-stone-200 py-16 text-center dark:border-stone-800">
          <p className="font-medium text-stone-600 dark:text-stone-400">Nothing here yet. Check back soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col">
      {/* Slim sticky header: where am I, how far along am I */}
      <header className="sticky top-0 z-30 -mx-2 flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50/95 px-2 py-3 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/95">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label={`Back to ${program.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition hover:bg-white hover:text-kat-clay dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{lesson.title}</p>
            <p className="truncate text-[11px] text-stone-400 dark:text-stone-500">{lesson.module.title}</p>
          </div>
          {isCompleted && (
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 sm:flex">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
          )}
        </div>

        {/* Step dots + counter. The dots are the true position, not scroll. */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1 sm:flex">
            {visibleContents.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to step ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === step
                    ? "w-5 bg-kat-clay"
                    : i < step || onCompletionStep
                      ? "w-2 bg-kat-clay/40"
                      : "w-2 bg-stone-300 dark:bg-stone-700"
                }`}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
            {onCompletionStep ? "Done" : `${step + 1} / ${totalSteps}`}
          </span>
        </div>
      </header>

      {/* Steps. All stay mounted (hidden) so playground code and lab progress
          survive stepping back and forth; only the active one is visible. */}
      <div className="flex-1 py-5">
        {visibleContents.map((content, i) => {
          const cfg = TYPE_CONFIG[content.type];
          const { Icon } = cfg;
          return (
            <section key={content.id} className={i === step ? "" : "hidden"} aria-hidden={i !== step}>
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-kat-clay" />
                <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                  {content.title}
                </h2>
                <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                  {cfg.label}
                </span>
              </div>
              <ContentBody
                content={content}
                isCreator={false}
                userId={userId}
                programId={programId}
                moduleId={lesson.module.id}
                onLabComplete={markComplete}
              />
            </section>
          );
        })}

        {/* Completion step, reached by finishing the lesson */}
        {onCompletionStep && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-[var(--kat-pine)] px-6 py-12 text-center text-white"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <Sparkles className="h-7 w-7 text-[var(--kat-sun)]" />
            </div>
            <p className="mt-4 font-display text-2xl font-bold">Lesson complete!</p>
            <p className="mt-1 text-sm text-white/70">Great work finishing {lesson.title}.</p>

            <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:gap-3">
              {prevLesson && (
                <button
                  onClick={() => router.push(`${lessonBasePath}/${prevLesson.id}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" /> Previous lesson
                </button>
              )}
              {nextLesson ? (
                <button
                  onClick={() => router.push(`${lessonBasePath}/${nextLesson.id}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[var(--kat-pine)] transition hover:bg-white/90"
                >
                  <span className="truncate">Next: {nextLesson.title.length > 22 ? nextLesson.title.slice(0, 22) + "…" : nextLesson.title}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <Link
                  href={backHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[var(--kat-pine)] transition hover:bg-white/90"
                >
                  Back to Course
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Step navigation: big, obvious, never overlapping content */}
      {!onCompletionStep && (
        <footer className="sticky bottom-0 z-30 -mx-2 flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/95 px-2 py-3 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/95">
          <button
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-40 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => goTo(step + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-kat-clay px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-kat-clay-deep"
          >
            {step === totalSteps - 1 ? "Finish lesson" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      )}
    </div>
  );
}
