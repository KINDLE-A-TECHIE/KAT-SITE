"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ExternalLink,
  FileText, Link as LinkIcon, Plus, Sparkles,
  Terminal, Video, Youtube, XCircle,
} from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ContentCreateForm } from "@/components/dashboard/content-create-form";
import { CodePlaygroundBlock } from "@/components/dashboard/code-playground-block";

type ContentItem = {
  id: string;
  type: "RICH_TEXT" | "YOUTUBE_EMBED" | "EXTERNAL_VIDEO" | "DOCUMENT_LINK" | "CODE_PLAYGROUND";
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
  RICH_TEXT:       { label: "Reading",  Icon: FileText,  accent: "bg-orange-500",   ring: "ring-orange-100 dark:ring-orange-900/50",   iconBg: "bg-orange-100 dark:bg-orange-900/40",   iconColor: "text-orange-600 dark:text-orange-400"   },
  YOUTUBE_EMBED:   { label: "Video",    Icon: Youtube,   accent: "bg-red-500",    ring: "ring-red-100 dark:ring-red-900/50",     iconBg: "bg-red-100 dark:bg-red-900/40",     iconColor: "text-red-600 dark:text-red-400"     },
  EXTERNAL_VIDEO:  { label: "Video",    Icon: Video,     accent: "bg-orange-500", ring: "ring-orange-100 dark:ring-orange-900/50", iconBg: "bg-orange-100 dark:bg-orange-900/40", iconColor: "text-orange-600 dark:text-orange-400" },
  DOCUMENT_LINK:   { label: "Resource", Icon: LinkIcon,  accent: "bg-orange-500", ring: "ring-orange-100 dark:ring-orange-900/50", iconBg: "bg-orange-100 dark:bg-orange-900/40", iconColor: "text-orange-600 dark:text-orange-400" },
  CODE_PLAYGROUND: { label: "Try it!",  Icon: Terminal,  accent: "bg-emerald-500",ring: "ring-emerald-100 dark:ring-emerald-900/50",iconBg:"bg-emerald-100 dark:bg-emerald-900/40",iconColor:"text-emerald-600 dark:text-emerald-400"},
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
      <div className="aspect-video overflow-hidden rounded-xl shadow-md">
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
      <div className="aspect-video overflow-hidden rounded-xl shadow-md">
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
    <video controls className="w-full rounded-xl shadow-md" src={url}>
      <track kind="captions" />
      Your browser does not support the video tag.
    </video>
  );
}

function ContentBlock({
  content,
  index,
  total,
  isCreator,
  isSA,
  userId,
  programId,
  moduleId,
  onReview,
}: {
  content: ContentItem;
  index: number;
  total: number;
  isCreator: boolean;
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
    <div className={`overflow-hidden rounded-2xl bg-white ring-1 shadow-sm dark:bg-stone-900 ${cfg.ring}`}>
      {/* Colored accent bar */}
      <div className={`h-1.5 w-full ${cfg.accent}`} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}>
            <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
          </div>
          <div>
            <p className="font-semibold text-stone-900 dark:text-stone-100 leading-tight">{content.title}</p>
            <p className={`text-[11px] font-medium ${cfg.iconColor}`}>{cfg.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isCreator && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${REVIEW_STYLE[content.reviewStatus]}`}>
              {content.reviewStatus.replace("_", " ")}
            </span>
          )}
          <span className="text-[11px] text-stone-400 dark:text-stone-500">{index + 1}/{total}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-4 sm:px-5 sm:pb-5">
        {content.type === "RICH_TEXT" && content.body && (
          <div
            className="prose prose-stone dark:prose-invert max-w-none text-[15px] leading-relaxed"
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
            className="group flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3 transition hover:border-orange-200 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 sm:gap-4 sm:p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/50 sm:h-12 sm:w-12">
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
      </div>

      {/* Rejection note */}
      {content.reviewNote && content.reviewStatus === "REJECTED" && (
        <div className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          <strong>Rejection note:</strong> {content.reviewNote}
        </div>
      )}

      {/* SA review controls */}
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

export function LessonViewer({ lessonId, programId, role, userId }: { lessonId: string; programId: string; role: string; userId?: string }) {
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [prevLesson, setPrevLesson] = useState<LessonNav>(null);
  const [nextLesson, setNextLesson] = useState<LessonNav>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddContent, setShowAddContent] = useState(false);
  const completionFired = useRef(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<(HTMLElement | null)[]>([]);
  const [showStickyNav, setShowStickyNav] = useState(false);
  const [activeContentIndex, setActiveContentIndex] = useState(0);

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
        completionFired.current = data.isCompleted; // don't re-fire if already done
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset per-lesson state when navigating to a different lesson
  useEffect(() => {
    contentRefs.current = [];
    setActiveContentIndex(0);
    setShowStickyNav(false);
  }, [lessonId]);

  // Show floating nav pill once the hero header scrolls out of view
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyNav(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lesson]);

  // Track which content block is in view to drive the progress dots
  useEffect(() => {
    const els = contentRefs.current.filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const observers = els.map((el, i) => {
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry?.isIntersecting) setActiveContentIndex(i); },
        { threshold: 0.4, rootMargin: "0px 0px -30% 0px" },
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [lesson]);

  // Mark lesson complete when the completion footer is shown (learners only)
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
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 py-16 text-center dark:border-stone-700">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-stone-300 dark:text-stone-600" />
        <p className="font-medium text-stone-500 dark:text-stone-400">Lesson not found or you don&apos;t have access.</p>
        <Link href={`/dashboard/curriculum/${programId}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#B2401D] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to course
        </Link>
      </div>
    );
  }

  const program = lesson.module.version.curriculum.program;
  const visibleContents = isCreator
    ? lesson.contents
    : lesson.contents.filter((c) => c.reviewStatus === "PUBLISHED");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Hero header */}
      <div ref={heroRef} className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1714] to-[#B2401D] px-4 py-5 text-white shadow-md sm:px-6 sm:py-6">
        {/* Back link */}
        <Link
          href={`/dashboard/curriculum/${program.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 transition hover:bg-white/20 hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          {program.name}
        </Link>

        {/* Module chip */}
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            {lesson.module.title}
          </span>
          {isCompleted && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
          )}
        </div>

        {/* Lesson title */}
        <h1 className="mt-2 [font-family:var(--font-space-grotesk)] text-xl font-bold leading-snug sm:text-2xl">
          {lesson.title}
        </h1>
        {lesson.description && (
          <p className="mt-1.5 text-sm leading-relaxed text-white/70">{lesson.description}</p>
        )}

        {/* Progress dots */}
        {visibleContents.length > 0 && (
          <div className="mt-4 flex items-center gap-1.5">
            {visibleContents.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeContentIndex ? "w-6 bg-white" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
            <span className="ml-2 text-[11px] text-white/50">
              {visibleContents.length} section{visibleContents.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {visibleContents.length === 0 && !showAddContent && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-200 py-16 text-center dark:border-stone-700">
          <span className="text-5xl">📚</span>
          <p className="font-medium text-stone-600 dark:text-stone-400">
            {isCreator ? "No content yet, add your first block below." : "Nothing here yet. Check back soon!"}
          </p>
        </div>
      )}

      {/* Content blocks */}
      <div className="space-y-4">
        {visibleContents.map((content, i) => (
          <motion.div
            key={content.id}
            ref={(el) => { contentRefs.current[i] = el; }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <ContentBlock
              content={content}
              index={i}
              total={visibleContents.length}
              isCreator={isCreator}
              isSA={isSA}
              userId={userId}
              programId={programId}
              moduleId={lesson.module.id}
              onReview={reviewContent}
            />
          </motion.div>
        ))}
      </div>

      {/* Completion footer (learners only) */}
      {!isCreator && visibleContents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: visibleContents.length * 0.06 + 0.1 }}
          onAnimationComplete={markComplete}
          className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 py-8 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20"
        >
          <div className="flex flex-col items-center gap-3 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
              <Sparkles className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-emerald-800 dark:text-emerald-300">You&apos;ve reached the end!</p>
              <p className="mt-0.5 text-sm text-emerald-600 dark:text-emerald-500">Great work finishing this lesson.</p>
            </div>

            {/* Navigation buttons */}
            <div className="mt-2 flex w-full flex-col items-stretch gap-2 px-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:px-0">
              {prevLesson && (
                <button
                  onClick={() => router.push(`/dashboard/curriculum/${programId}/lessons/${prevLesson.id}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>
              )}

              {nextLesson ? (
                <button
                  onClick={() => router.push(`/dashboard/curriculum/${programId}/lessons/${nextLesson.id}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B2401D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8F3316]"
                >
                  <span className="truncate">Next: {nextLesson.title.length > 22 ? nextLesson.title.slice(0, 22) + "…" : nextLesson.title}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <Link
                  href={`/dashboard/curriculum/${program.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B2401D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8F3316]"
                >
                  Back to Course
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Floating navigation pill, appears once the hero scrolls out of view */}
      <AnimatePresence>
        {showStickyNav && !isCreator && (prevLesson ?? nextLesson) && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-3"
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-stone-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95">
              {prevLesson && (
                <button
                  onClick={() => router.push(`/dashboard/curriculum/${programId}/lessons/${prevLesson.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Prev
                </button>
              )}
              <span className="max-w-[100px] truncate text-xs font-medium text-stone-500 dark:text-stone-400 sm:max-w-[160px]">
                {lesson.title}
              </span>
              {nextLesson && (
                <button
                  onClick={() => router.push(`/dashboard/curriculum/${programId}/lessons/${nextLesson.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B2401D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8F3316]"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add content (creators) */}
      {isCreator && (
        <AnimatePresence>
          {showAddContent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-[#B2401D]/30 bg-orange-50/40 p-5 dark:bg-orange-950/20"
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
                className="w-full gap-2 rounded-2xl border-dashed border-[#B2401D]/40 py-6 text-[#B2401D] hover:bg-orange-50 dark:hover:bg-orange-950/20"
                onClick={() => setShowAddContent(true)}
              >
                <Plus className="h-4 w-4" />
                Add Content Block
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
