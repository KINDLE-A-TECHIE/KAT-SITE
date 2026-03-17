"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, ExternalLink, FileText,
  Link as LinkIcon, Plus, Terminal, Video, Youtube, XCircle
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

const REVIEW_STYLES = {
  PENDING_REVIEW: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  PUBLISHED: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
  REJECTED: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400",
};

const CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function sanitizeHtml(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function ContentBlock({
  content,
  role,
  onReview,
}: {
  content: ContentItem;
  role: string;
  onReview: (id: string, action: "PUBLISH" | "REJECT", note?: string) => Promise<void>;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);
  const isCreator = CREATOR_ROLES.includes(role);
  const isSA = role === "SUPER_ADMIN";

  const review = async (action: "PUBLISH" | "REJECT") => {
    setBusy(true);
    await onReview(content.id, action, action === "REJECT" ? rejectNote : undefined);
    setBusy(false);
    setShowReject(false);
    setRejectNote("");
  };

  return (
    <div className={`overflow-hidden rounded-xl border ${content.reviewStatus === "REJECTED" ? "border-rose-200 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`}>
      {/* Content header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {content.type === "RICH_TEXT" && <FileText className="h-4 w-4 text-slate-500" />}
          {content.type === "YOUTUBE_EMBED" && <Youtube className="h-4 w-4 text-red-500" />}
          {content.type === "EXTERNAL_VIDEO" && <Video className="h-4 w-4 text-blue-500" />}
          {content.type === "DOCUMENT_LINK" && <LinkIcon className="h-4 w-4 text-violet-500" />}
          {content.type === "CODE_PLAYGROUND" && <Terminal className="h-4 w-4 text-emerald-500" />}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{content.title}</span>
        </div>
        {isCreator && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STYLES[content.reviewStatus]}`}>
            {content.reviewStatus.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Content body */}
      <div className="p-4">
        {content.type === "RICH_TEXT" && content.body && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.body) }}
          />
        )}
        {content.type === "YOUTUBE_EMBED" && content.url && (() => {
          const vid = extractYouTubeId(content.url);
          return vid ? (
            <div className="aspect-video overflow-hidden rounded-lg">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${vid}`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={content.title}
              />
            </div>
          ) : (
            <a href={content.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1E5FAF] hover:underline">
              {content.url}
            </a>
          );
        })()}
        {content.type === "EXTERNAL_VIDEO" && content.url && (
          <div>
            <video controls className="w-full rounded-lg" src={content.url}>
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          </div>
        )}
        {content.type === "DOCUMENT_LINK" && content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileText className="h-8 w-8 shrink-0 text-violet-400" />
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800 dark:text-slate-200">{content.title}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{content.url}</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
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

      {/* SA review controls */}
      {isSA && content.reviewStatus === "PENDING_REVIEW" && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
          {!showReject ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void review("PUBLISH")}
                className="gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />Publish
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowReject(true)}
                className="gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50">
                <XCircle className="h-3.5 w-3.5" />Reject
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

      {content.reviewNote && content.reviewStatus === "REJECTED" && (
        <div className="border-t border-rose-100 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-400">
          <strong>Rejection note:</strong> {content.reviewNote}
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
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="kat-card py-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">Lesson not found or you don&apos;t have access.</p>
        <Link href={`/dashboard/curriculum/${programId}`} className="mt-3 inline-block text-sm text-[#1E5FAF] hover:underline">
          ← Back to curriculum
        </Link>
      </div>
    );
  }

  const program = lesson.module.version.curriculum.program;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + header */}
      <div className="kat-card">
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <Link href="/dashboard/curriculum" className="hover:text-slate-600 dark:hover:text-slate-300">Programs</Link>
          <span>/</span>
          <Link href={`/dashboard/curriculum/${program.id}`} className="hover:text-slate-600 dark:hover:text-slate-300">{program.name}</Link>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-400">{lesson.module.title}</span>
          <span>/</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">{lesson.title}</span>
        </nav>
        <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900 dark:text-slate-100">{lesson.title}</h2>
        {lesson.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{lesson.description}</p>}
      </div>

      {/* Content items */}
      <div className="space-y-3">
        {lesson.contents.length === 0 && !showAddContent && (
          <div className="kat-card py-12 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-slate-500 dark:text-slate-400">{isCreator ? "No content yet. Add some below." : "No content published yet."}</p>
          </div>
        )}
        {lesson.contents.map((content, i) => (
          <motion.div key={content.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <ContentBlock content={content} role={role} onReview={reviewContent} />
          </motion.div>
        ))}
      </div>

      {/* Add content */}
      {isCreator && (
        <div>
          <AnimatePresence>
            {showAddContent ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="kat-card border border-[#1E5FAF]/30 bg-blue-50/20"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Add Content</h3>
                  <button onClick={() => setShowAddContent(false)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">Cancel</button>
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
                  className="w-full gap-2 rounded-xl border-dashed border-[#1E5FAF]/40 text-[#1E5FAF] hover:bg-blue-50"
                  onClick={() => setShowAddContent(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Content
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}