"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, CheckCircle2, ExternalLink,
  FileText, Link as LinkIcon, Plus, Sparkles,
  Terminal, Video, Youtube, XCircle,
} from "lucide-react";
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
  RICH_TEXT:       { label: "Reading",  Icon: FileText,  accent: "bg-blue-500",   ring: "ring-blue-100 dark:ring-blue-900/50",   iconBg: "bg-blue-100 dark:bg-blue-900/40",   iconColor: "text-blue-600 dark:text-blue-400"   },
  YOUTUBE_EMBED:   { label: "Video",    Icon: Youtube,   accent: "bg-red-500",    ring: "ring-red-100 dark:ring-red-900/50",     iconBg: "bg-red-100 dark:bg-red-900/40",     iconColor: "text-red-600 dark:text-red-400"     },
  EXTERNAL_VIDEO:  { label: "Video",    Icon: Video,     accent: "bg-orange-500", ring: "ring-orange-100 dark:ring-orange-900/50", iconBg: "bg-orange-100 dark:bg-orange-900/40", iconColor: "text-orange-600 dark:text-orange-400" },
  DOCUMENT_LINK:   { label: "Resource", Icon: LinkIcon,  accent: "bg-violet-500", ring: "ring-violet-100 dark:ring-violet-900/50", iconBg: "bg-violet-100 dark:bg-violet-900/40", iconColor: "text-violet-600 dark:text-violet-400" },
  CODE_PLAYGROUND: { label: "Try it!",  Icon: Terminal,  accent: "bg-emerald-500",ring: "ring-emerald-100 dark:ring-emerald-900/50",iconBg:"bg-emerald-100 dark:bg-emerald-900/40",iconColor:"text-emerald-600 dark:text-emerald-400"},
} as const;

const REVIEW_STYLE = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  PUBLISHED:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  REJECTED:       "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

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

function sanitizeHtml(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
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
  onReview,
}: {
  content: ContentItem;
  index: number;
  total: number;
  isCreator: boolean;
  isSA: boolean;
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
    <div className={`overflow-hidden rounded-2xl bg-white ring-1 shadow-sm dark:bg-slate-900 ${cfg.ring}`}>
      {/* Colored accent bar */}
      <div className={`h-1.5 w-full ${cfg.accent}`} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}>
            <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{content.title}</p>
            <p className={`text-[11px] font-medium ${cfg.iconColor}`}>{cfg.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isCreator && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${REVIEW_STYLE[content.reviewStatus]}`}>
              {content.reviewStatus.replace("_", " ")}
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{index + 1}/{total}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pb-5">
        {content.type === "RICH_TEXT" && content.body && (
          <div
            className="prose prose-slate dark:prose-invert max-w-none text-[15px] leading-relaxed"
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
            className="group flex items-center gap-4 rounded-xl border border-violet-100 bg-violet-50 p-4 transition hover:border-violet-200 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/30 dark:hover:bg-violet-950/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-violet-900 dark:text-violet-100">{content.title}</p>
              <p className="mt-0.5 truncate text-xs text-violet-500 dark:text-violet-400">{content.url}</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-violet-400 transition group-hover:text-violet-600 dark:group-hover:text-violet-300" />
          </a>
        )}

        {content.type === "CODE_PLAYGROUND" && content.language && (
          <CodePlaygroundBlock
            contentId={content.id}
            starterCode={content.body ?? ""}
            language={content.language}
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
        <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
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

export function LessonViewer({ lessonId, programId, role }: { lessonId: string; programId: string; role: string }) {
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddContent, setShowAddContent] = useState(false);

  const isCreator = CREATOR_ROLES.includes(role);
  const isSA = role === "SUPER_ADMIN";

  const load = async () => {
    try {
      const res = await fetch(`/api/curriculum/lessons/${lessonId}`);
      if (res.ok) {
        const data = await res.json() as { lesson: LessonData };
        setLesson(data.lesson);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="font-medium text-slate-500 dark:text-slate-400">Lesson not found or you don&apos;t have access.</p>
        <Link href={`/dashboard/curriculum/${programId}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1E5FAF] hover:underline">
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
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1F45] to-[#1E5FAF] px-6 py-6 text-white shadow-md">
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
        </div>

        {/* Lesson title */}
        <h1 className="mt-2 [font-family:var(--font-space-grotesk)] text-2xl font-bold leading-snug">
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
                  i === 0 ? "w-6 bg-white" : "w-1.5 bg-white/30"
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
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
          <span className="text-5xl">📚</span>
          <p className="font-medium text-slate-600 dark:text-slate-400">
            {isCreator ? "No content yet — add your first block below." : "Nothing here yet. Check back soon!"}
          </p>
        </div>
      )}

      {/* Content blocks */}
      <div className="space-y-4">
        {visibleContents.map((content, i) => (
          <motion.div
            key={content.id}
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
          className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 py-8 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <Sparkles className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-emerald-800 dark:text-emerald-300">You&apos;ve reached the end!</p>
            <p className="mt-0.5 text-sm text-emerald-600 dark:text-emerald-500">Great work finishing this lesson.</p>
          </div>
          <Link
            href={`/dashboard/curriculum/${program.id}`}
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[#1E5FAF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a4f8f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Course
          </Link>
        </motion.div>
      )}

      {/* Add content (creators) */}
      {isCreator && (
        <AnimatePresence>
          {showAddContent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-[#1E5FAF]/30 bg-blue-50/40 p-5 dark:bg-blue-950/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Add Content Block</h3>
                <button
                  onClick={() => setShowAddContent(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
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
                className="w-full gap-2 rounded-2xl border-dashed border-[#1E5FAF]/40 py-6 text-[#1E5FAF] hover:bg-blue-50 dark:hover:bg-blue-950/20"
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
