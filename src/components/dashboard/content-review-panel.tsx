"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, ChevronDown, ExternalLink, FileText,
  Link as LinkIcon, Network, RefreshCw, Terminal, Video, XCircle, Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PaginationControls } from "@/components/pagination-controls";

type ContentItem = {
  id: string;
  type: "RICH_TEXT" | "YOUTUBE_EMBED" | "EXTERNAL_VIDEO" | "DOCUMENT_LINK" | "CODE_PLAYGROUND" | "NETWORK_LAB";
  title: string;
  body: string | null;
  url: string | null;
  language: string | null;
  reviewStatus: "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
  lesson: {
    id: string;
    title: string;
    module: {
      title: string;
      version: {
        label: string;
        versionNumber: number;
        curriculum: { program: { id: string; name: string } };
      };
    };
  };
};

const STATUS_FILTER_OPTIONS = [
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
];

const REVIEW_STYLES = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

const TYPE_ICONS = {
  RICH_TEXT:       <FileText className="h-4 w-4 text-stone-500" />,
  YOUTUBE_EMBED:   <Youtube className="h-4 w-4 text-red-500" />,
  EXTERNAL_VIDEO:  <Video className="h-4 w-4 text-orange-500" />,
  DOCUMENT_LINK:   <LinkIcon className="h-4 w-4 text-orange-500" />,
  CODE_PLAYGROUND: <Terminal className="h-4 w-4 text-emerald-500" />,
  NETWORK_LAB:     <Network className="h-4 w-4 text-amber-500" />,
};

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

function ReviewCard({
  content,
  onReviewed,
}: {
  content: ContentItem;
  onReviewed: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  const program = content.lesson.module.version.curriculum.program;
  const version = content.lesson.module.version;

  const review = async (action: "PUBLISH" | "REJECT") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/curriculum/contents/${content.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: action === "REJECT" ? rejectNote : undefined }),
      });
      if (res.ok) {
        toast.success(action === "PUBLISH" ? "Content published!" : "Content rejected.");
        onReviewed();
      } else {
        toast.error("Failed to update review status.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
      setShowReject(false);
      setRejectNote("");
    }
  };

  return (
    <div className={`overflow-hidden rounded-xl border ${content.reviewStatus === "REJECTED" ? "border-rose-200 dark:border-rose-800" : content.reviewStatus === "PUBLISHED" ? "border-emerald-200 dark:border-emerald-800" : "border-stone-200 dark:border-stone-700"}`}>
      {/* Header */}
      <div
        className="flex cursor-pointer items-start justify-between gap-3 bg-stone-50 px-4 py-3 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            {TYPE_ICONS[content.type]}
            <span className="truncate text-sm font-medium text-stone-800 dark:text-stone-200">{content.title}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STYLES[content.reviewStatus]}`}>
              {content.reviewStatus.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {program.name} › v{version.versionNumber} ({version.label}) › {content.lesson.module.title} › {content.lesson.title}
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            By {content.createdBy.firstName} {content.createdBy.lastName} · {new Date(content.createdAt).toLocaleDateString()}
          </p>
        </div>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>

      {/* Expandable preview */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-stone-100 p-4 dark:border-stone-800">
              {content.type === "RICH_TEXT" && content.body && (
                <div
                  className="prose prose-sm max-w-none text-stone-700 dark:text-stone-300"
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
                  <a href={content.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#B2401D] hover:underline">
                    {content.url}
                  </a>
                );
              })()}
              {content.type === "EXTERNAL_VIDEO" && content.url && (
                <video controls className="w-full rounded-lg" src={content.url}>
                  <track kind="captions" />
                  Your browser does not support the video tag.
                </video>
              )}
              {content.type === "DOCUMENT_LINK" && content.url && (
                <a
                  href={content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-stone-200 p-4 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  <FileText className="h-8 w-8 shrink-0 text-orange-400" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-800 dark:text-stone-200">{content.title}</p>
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400">{content.url}</p>
                  </div>
                  <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-stone-400" />
                </a>
              )}
              {content.type === "CODE_PLAYGROUND" && content.body && (
                <div className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
                  <div className="flex items-center gap-2 border-b border-stone-200 bg-[#1e1e1e] px-3 py-2 dark:border-stone-700">
                    <Terminal className="h-3.5 w-3.5 text-stone-400" />
                    <span className="text-xs font-medium text-stone-300">{content.language ?? "code"}</span>
                  </div>
                  <pre className="max-h-64 overflow-auto bg-[#1e1e1e] px-4 py-3 font-mono text-xs text-stone-200">
                    {content.body}
                  </pre>
                </div>
              )}
              {content.type === "NETWORK_LAB" && content.body && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
                  <Network className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-stone-700 dark:text-stone-300">
                    Network Lab level: <span className="font-mono">{content.body}</span>
                  </span>
                </div>
              )}

              {content.reviewNote && content.reviewStatus === "REJECTED" && (
                <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-400">
                  <strong>Rejection note:</strong> {content.reviewNote}
                </div>
              )}
            </div>

            {/* Review actions, only for PENDING_REVIEW */}
            {content.reviewStatus === "PENDING_REVIEW" && (
              <div className="border-t border-stone-100 px-4 py-3 dark:border-stone-800">
                {!showReject ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void review("PUBLISH")}
                      className="gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setShowReject(true)}
                      className="gap-1.5 border-rose-200 text-xs text-rose-600 hover:bg-rose-50"
                    >
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
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void review("REJECT")}
                        className="gap-1.5 bg-rose-600 text-xs hover:bg-rose-700"
                      >
                        Confirm Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ContentReviewPanel() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/curriculum/review?status=${statusFilter}&page=${page}`);
      if (res.ok) {
        const data = await res.json() as { items: ContentItem[]; page?: number; totalPages?: number; total?: number };
        setContents(data.items);
        setMeta({ page: data.page ?? 1, totalPages: data.totalPages ?? 1, total: data.total ?? data.items.length });
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [statusFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="kat-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-stone-900 dark:text-stone-100">Content Review</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">Review and publish lesson content submitted by admins and instructors.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Status filter */}
      <div className="kat-card flex gap-1 p-1.5">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-[#B2401D] text-white"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : contents.length === 0 ? (
        <div className="kat-card py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-stone-300" />
          <p className="text-stone-500 dark:text-stone-400">
            {statusFilter === "PENDING_REVIEW"
              ? "No content pending review."
              : statusFilter === "PUBLISHED"
              ? "No published content found."
              : "No rejected content found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-stone-400 dark:text-stone-500">{meta.total} item{meta.total !== 1 ? "s" : ""}</p>
          <AnimatePresence>
            {contents.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.03 }}
              >
                <ReviewCard content={c} onReviewed={() => void load()} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
        disabled={loading}
      />
    </div>
  );
}