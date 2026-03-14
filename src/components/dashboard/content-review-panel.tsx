"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, ChevronDown, ExternalLink, FileText,
  Link as LinkIcon, RefreshCw, Terminal, Video, XCircle, Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type ContentItem = {
  id: string;
  type: "RICH_TEXT" | "YOUTUBE_EMBED" | "EXTERNAL_VIDEO" | "DOCUMENT_LINK" | "CODE_PLAYGROUND";
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
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const TYPE_ICONS = {
  RICH_TEXT:       <FileText className="h-4 w-4 text-slate-500" />,
  YOUTUBE_EMBED:   <Youtube className="h-4 w-4 text-red-500" />,
  EXTERNAL_VIDEO:  <Video className="h-4 w-4 text-blue-500" />,
  DOCUMENT_LINK:   <LinkIcon className="h-4 w-4 text-violet-500" />,
  CODE_PLAYGROUND: <Terminal className="h-4 w-4 text-emerald-500" />,
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
    <div className={`overflow-hidden rounded-xl border ${content.reviewStatus === "REJECTED" ? "border-rose-200" : content.reviewStatus === "PUBLISHED" ? "border-emerald-200" : "border-slate-200"}`}>
      {/* Header */}
      <div
        className="flex cursor-pointer items-start justify-between gap-3 bg-slate-50 px-4 py-3 hover:bg-slate-100"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            {TYPE_ICONS[content.type]}
            <span className="truncate text-sm font-medium text-slate-800">{content.title}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STYLES[content.reviewStatus]}`}>
              {content.reviewStatus.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {program.name} › v{version.versionNumber} ({version.label}) › {content.lesson.module.title} › {content.lesson.title}
          </p>
          <p className="text-xs text-slate-400">
            By {content.createdBy.firstName} {content.createdBy.lastName} · {new Date(content.createdAt).toLocaleDateString()}
          </p>
        </div>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
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
            <div className="border-t border-slate-100 p-4">
              {content.type === "RICH_TEXT" && content.body && (
                <div
                  className="prose prose-sm max-w-none text-slate-700"
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
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50"
                >
                  <FileText className="h-8 w-8 shrink-0 text-violet-400" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{content.title}</p>
                    <p className="truncate text-xs text-slate-500">{content.url}</p>
                  </div>
                  <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                </a>
              )}
              {content.type === "CODE_PLAYGROUND" && content.body && (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-[#1e1e1e] px-3 py-2">
                    <Terminal className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300">{content.language ?? "code"}</span>
                  </div>
                  <pre className="max-h-64 overflow-auto bg-[#1e1e1e] px-4 py-3 font-mono text-xs text-slate-200">
                    {content.body}
                  </pre>
                </div>
              )}

              {content.reviewNote && content.reviewStatus === "REJECTED" && (
                <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <strong>Rejection note:</strong> {content.reviewNote}
                </div>
              )}
            </div>

            {/* Review actions — only for PENDING_REVIEW */}
            {content.reviewStatus === "PENDING_REVIEW" && (
              <div className="border-t border-slate-100 px-4 py-3">
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

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/curriculum/review?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json() as { items: ContentItem[] };
        setContents(data.items);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="kat-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900">Content Review</h2>
          <p className="text-sm text-slate-500">Review and publish lesson content submitted by admins and instructors.</p>
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
            onClick={() => setStatusFilter(opt.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-[#1E5FAF] text-white"
                : "text-slate-600 hover:bg-slate-100"
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
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-slate-500">
            {statusFilter === "PENDING_REVIEW"
              ? "No content pending review."
              : statusFilter === "PUBLISHED"
              ? "No published content found."
              : "No rejected content found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{contents.length} item{contents.length !== 1 ? "s" : ""}</p>
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
    </div>
  );
}