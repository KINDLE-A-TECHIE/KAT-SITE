"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Undo2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRoleValue } from "@/lib/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectFile = { id: string; name: string; mimeType: string; size: number; url: string };
type ProjectAsset = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  description: string | null;
  uploadedAt: string;
  uploader: { firstName: string; lastName: string };
};
type FeedbackItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; role: string };
};
type ReviewItem = {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "NEEDS_WORK" | "REJECTED";
  createdAt: string;
  reviewer: { id: string; firstName: string; lastName: string };
};
type Project = {
  id: string;
  title: string;
  description: string | null;
  howToUse: string | null;
  tags: string[];
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "NEEDS_WORK" | "REJECTED";
  deployedUrl: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  program: { id: string; name: string } | null;
  files: ProjectFile[];
  feedback: FeedbackItem[];
  reviews?: ReviewItem[];
  assets?: ProjectAsset[];
  student?: { id: string; firstName: string; lastName: string };
};
type Program = { id: string; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    description: "Not submitted yet",
  },
  SUBMITTED: {
    label: "Under Review",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    description: "Waiting for instructor review",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    description: "Great work!",
  },
  NEEDS_WORK: {
    label: "Needs Work",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    description: "Review feedback and resubmit",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    description: "See feedback below",
  },
};

const STATUS_GROUPS: { label: string; statuses: Project["status"][]; emptyText: string }[] = [
  { label: "Needs Attention", statuses: ["NEEDS_WORK"], emptyText: "" },
  { label: "Drafts", statuses: ["DRAFT"], emptyText: "No drafts." },
  { label: "Under Review", statuses: ["SUBMITTED"], emptyText: "Nothing pending review." },
  { label: "Completed", statuses: ["APPROVED", "REJECTED"], emptyText: "No completed projects yet." },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── File Uploader ─────────────────────────────────────────────────────────────

function FileUploader({ projectId, onUploaded }: { projectId: string; onUploaded: (file: ProjectFile) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setUploading(true);
    setProgress(0);
    try {
      const urlRes = await fetch(`/api/projects/${projectId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size }),
      });
      if (!urlRes.ok) {
        const err = (await urlRes.json()) as { error?: string };
        toast.error(err?.error ?? "Could not get upload URL.");
        return;
      }
      const { uploadUrl, key, publicUrl } = (await urlRes.json()) as { uploadUrl: string; key: string; publicUrl: string };

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      const confirmRes = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, storageKey: key, url: publicUrl }),
      });
      if (!confirmRes.ok) { toast.error("Could not save file record."); return; }
      const { file: saved } = (await confirmRes.json()) as { file: ProjectFile };
      toast.success(`${file.name} uploaded!`);
      onUploaded(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500 dark:hover:bg-blue-900/10"
      >
        {uploading ? (
          <>
            <Loader2 className="size-5 animate-spin text-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Uploading… {progress}%</span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <Upload className="size-5 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to upload a file</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">Images, videos, PDFs, ZIPs, code · Max 20 MB</span>
          </>
        )}
      </button>
    </div>
  );
}

// ── Asset Uploader ────────────────────────────────────────────────────────────

function AssetUploader({ projectId, onUploaded }: { projectId: string; onUploaded: (asset: ProjectAsset) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [assetDesc, setAssetDesc] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch(`/api/projects/${projectId}/assets/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size }),
      });
      if (!urlRes.ok) {
        const err = (await urlRes.json()) as { error?: string };
        toast.error(err?.error ?? "Could not get upload URL.");
        return;
      }
      const { uploadUrl, key, publicUrl } = (await urlRes.json()) as { uploadUrl: string; key: string; publicUrl: string };

      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });

      const confirmRes = await fetch(`/api/projects/${projectId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, storageKey: key, url: publicUrl, description: assetDesc || undefined }),
      });
      if (!confirmRes.ok) { toast.error("Could not save asset."); return; }
      const { asset } = (await confirmRes.json()) as { asset: ProjectAsset };
      toast.success(`${file.name} uploaded as asset!`);
      onUploaded(asset);
      setAssetDesc("");
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Input
        value={assetDesc}
        onChange={(e) => setAssetDesc(e.target.value)}
        placeholder="Asset description (optional)…"
        className="text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        maxLength={500}
      />
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); void handleUpload(f); } }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-2.5 text-sm text-blue-600 transition hover:border-blue-400 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Uploading asset…" : "Upload asset file"}
      </button>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  isReviewer,
  onUpdate,
  onDelete,
}: {
  project: Project;
  isReviewer: boolean;
  onUpdate: (updated: Project) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [p, setP] = useState(project);

  // Edit form state
  const [editForm, setEditForm] = useState({ title: p.title, description: p.description ?? "", tags: p.tags.join(", "), deployedUrl: p.deployedUrl ?? "", howToUse: p.howToUse ?? "" });

  const cfg = STATUS_CONFIG[p.status];
  const canEdit = p.status === "DRAFT" || p.status === "NEEDS_WORK";
  const canSubmit = (p.status === "DRAFT" || p.status === "NEEDS_WORK") && (p.files.length > 0 || !!p.deployedUrl);
  const canRetract = p.status === "SUBMITTED";

  const patch = async (data: Record<string, unknown>, successMsg: string) => {
    setSubmitting(true);
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { project: updated } = (await res.json()) as { project: Project };
      setP(updated);
      onUpdate(updated);
      toast.success(successMsg);
      return true;
    }
    const err = (await res.json()) as { error?: string };
    toast.error(err.error ?? "Something went wrong.");
    setSubmitting(false);
    return false;
  };

  const handleSaveEdit = async () => {
    const tags = editForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const ok = await patch({
      title: editForm.title,
      description: editForm.description || undefined,
      tags,
      deployedUrl: editForm.deployedUrl || "",
      howToUse: editForm.howToUse || undefined,
    }, "Project updated.");
    if (ok) setEditing(false);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    await patch({ status: "SUBMITTED" }, "Submitted for review!");
    setSubmitting(false);
  };

  const handleRetract = async () => {
    await patch({ status: "DRAFT" }, "Submission retracted — back to draft.");
    setSubmitting(false);
  };

  const handleReview = async (status: "APPROVED" | "NEEDS_WORK" | "REJECTED") => {
    setSubmitting(true);
    const res = await fetch(`/api/projects/${p.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const { project: updated } = (await res.json()) as { project: Project };
      const merged = { ...p, status: updated.status };
      setP(merged);
      onUpdate(merged);
      toast.success(`Marked as ${status.replace("_", " ").toLowerCase()}.`);
    } else {
      toast.error("Could not update status.");
    }
    setSubmitting(false);
  };

  const handleAddFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/projects/${p.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: feedbackText.trim() }),
    });
    if (res.ok) {
      const { feedback } = (await res.json()) as { feedback: FeedbackItem };
      const merged = { ...p, feedback: [...p.feedback, feedback] };
      setP(merged);
      onUpdate(merged);
      setFeedbackText("");
      toast.success("Feedback added.");
    } else {
      toast.error("Could not add feedback.");
    }
    setSubmitting(false);
  };

  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editingFeedbackText, setEditingFeedbackText] = useState("");

  const handleEditFeedback = (fb: FeedbackItem) => {
    setEditingFeedbackId(fb.id);
    setEditingFeedbackText(fb.body);
  };

  const handleSaveFeedback = async (feedbackId: string) => {
    if (!editingFeedbackText.trim()) return;
    const res = await fetch(`/api/projects/${p.id}/feedback/${feedbackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editingFeedbackText.trim() }),
    });
    if (res.ok) {
      const { feedback: updated } = (await res.json()) as { feedback: FeedbackItem };
      const merged = { ...p, feedback: p.feedback.map((fb) => (fb.id === feedbackId ? updated : fb)) };
      setP(merged);
      onUpdate(merged);
      setEditingFeedbackId(null);
      toast.success("Feedback updated.");
    } else {
      toast.error("Could not update feedback.");
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    const res = await fetch(`/api/projects/${p.id}/feedback/${feedbackId}`, { method: "DELETE" });
    if (res.ok) {
      const merged = { ...p, feedback: p.feedback.filter((fb) => fb.id !== feedbackId) };
      setP(merged);
      onUpdate(merged);
      toast.success("Feedback removed.");
    } else {
      toast.error("Could not remove feedback.");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const res = await fetch(`/api/projects/${p.id}/files/${fileId}`, { method: "DELETE" });
    if (res.ok) {
      const merged = { ...p, files: p.files.filter((f) => f.id !== fileId) };
      setP(merged);
      onUpdate(merged);
    } else {
      toast.error("Could not remove file.");
    }
  };

  const [coverUploading, setCoverUploading] = useState(false);

  const handleCoverImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only images allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Cover image must be under 5 MB."); return; }
    setCoverUploading(true);
    try {
      const urlRes = await fetch(`/api/projects/${p.id}/cover-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: file.type, size: file.size }),
      });
      if (!urlRes.ok) { toast.error("Could not get upload URL."); return; }
      const { uploadUrl, key, publicUrl } = (await urlRes.json()) as { uploadUrl: string; key: string; publicUrl: string };
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const confirmRes = await fetch(`/api/projects/${p.id}/cover-image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, url: publicUrl }),
      });
      if (!confirmRes.ok) { toast.error("Could not save cover image."); return; }
      const { coverImageUrl } = (await confirmRes.json()) as { coverImageUrl: string };
      const merged = { ...p, coverImageUrl };
      setP(merged);
      onUpdate(merged);
      toast.success("Cover image updated.");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleRemoveCoverImage = async () => {
    const res = await fetch(`/api/projects/${p.id}/cover-image`, { method: "DELETE" });
    if (res.ok) {
      const merged = { ...p, coverImageUrl: null };
      setP(merged);
      onUpdate(merged);
      toast.success("Cover image removed.");
    } else {
      toast.error("Could not remove cover image.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete(p.id);
      toast.success("Project deleted.");
    } else {
      toast.error("Could not delete project.");
      setDeleting(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    const res = await fetch(`/api/projects/${p.id}/assets/${assetId}`, { method: "DELETE" });
    if (res.ok) {
      const merged = { ...p, assets: (p.assets ?? []).filter((a) => a.id !== assetId) };
      setP(merged);
      onUpdate(merged);
      toast.success("Asset removed.");
    } else {
      toast.error("Could not remove asset.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Cover image */}
      {p.coverImageUrl && !editing && (
        <div className="relative h-36 w-full overflow-hidden rounded-t-xl sm:h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.coverImageUrl} alt={`${p.title} cover`} className="h-full w-full object-cover" />
          {canEdit && (
            <button
              onClick={() => void handleRemoveCoverImage()}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              title="Remove cover image"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
              {cfg.label}
            </span>
            {p.program && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {p.program.name}
              </span>
            )}
            {p.student && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {p.student.firstName} {p.student.lastName}
              </span>
            )}
          </div>

          {editing ? (
            <Input
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-2 font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              maxLength={120}
            />
          ) : (
            <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{p.title}</h3>
          )}

          {!editing && p.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {p.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  <Tag className="size-2.5" />{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span>{p.files.length} file{p.files.length !== 1 ? "s" : ""}</span>
            <span>{p.feedback.length} comment{p.feedback.length !== 1 ? "s" : ""}</span>
            <span>{formatDate(p.updatedAt)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canEdit && !editing && (
            <button
              onClick={() => { setEditing(true); setExpanded(true); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title="Edit project"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-slate-100 p-4 dark:border-slate-800">

              {/* Edit form */}
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Description</label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="What did you build?"
                      rows={3}
                      maxLength={2000}
                      className="text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Tags (comma separated)</label>
                      <Input
                        value={editForm.tags}
                        onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                        placeholder="python, web, game"
                        className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Live URL</label>
                      <Input
                        type="url"
                        value={editForm.deployedUrl}
                        onChange={(e) => setEditForm((f) => ({ ...f, deployedUrl: e.target.value }))}
                        placeholder="https://myproject.vercel.app"
                        className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">How to Use / Run</label>
                    <Textarea
                      value={editForm.howToUse}
                      onChange={(e) => setEditForm((f) => ({ ...f, howToUse: e.target.value }))}
                      placeholder="Instructions for running or using this project…"
                      rows={2}
                      maxLength={2000}
                      className="text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  {/* Cover image upload */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cover Image <span className="font-normal text-slate-400">(JPEG, PNG or WebP · max 5 MB)</span></label>
                    {p.coverImageUrl ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.coverImageUrl} alt="cover" className="h-14 w-24 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                        <Button size="sm" variant="outline" className="text-rose-500 hover:text-rose-600" onClick={() => void handleRemoveCoverImage()} disabled={coverUploading}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500">
                        {coverUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {coverUploading ? "Uploading…" : "Upload cover image"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCoverImageUpload(f); e.target.value = ""; }}
                          disabled={coverUploading}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => void handleSaveEdit()} disabled={submitting || !editForm.title.trim()}>
                      {submitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                      Save Changes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditForm({ title: p.title, description: p.description ?? "", tags: p.tags.join(", "), deployedUrl: p.deployedUrl ?? "", howToUse: p.howToUse ?? "" }); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {p.description && <p className="text-sm text-slate-600 dark:text-slate-400">{p.description}</p>}
                  {p.howToUse && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">How to Use</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">{p.howToUse}</p>
                    </div>
                  )}
                  {p.deployedUrl && (
                    <a href={p.deployedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400">
                      <ExternalLink className="size-3.5" /> View live project
                    </a>
                  )}
                </>
              )}

              {/* Files */}
              {!editing && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Files</p>
                  {p.files.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      No files uploaded.{p.deployedUrl ? " Project link provided above." : ""}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {p.files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="size-4 shrink-0 text-slate-400" />
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-blue-600 hover:underline dark:text-blue-400">
                              {file.name}
                            </a>
                            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatBytes(file.size)}</span>
                          </div>
                          {canEdit && (
                            <button onClick={() => void handleDeleteFile(file.id)} className="shrink-0 rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20">
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canEdit && p.files.length < 10 && (
                    <div className="mt-2">
                      <FileUploader projectId={p.id} onUploaded={(f) => { const merged = { ...p, files: [...p.files, f] }; setP(merged); onUpdate(merged); }} />
                    </div>
                  )}
                </div>
              )}

              {/* Feedback */}
              {p.feedback.length > 0 && !editing && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Feedback</p>
                  <div className="space-y-2">
                    {p.feedback.map((fb) => (
                      <div key={fb.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{fb.author.firstName} {fb.author.lastName}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(fb.createdAt)}</span>
                          </div>
                          {isReviewer && (
                            <div className="flex items-center gap-1 shrink-0">
                              {editingFeedbackId === fb.id ? (
                                <>
                                  <button onClick={() => void handleSaveFeedback(fb.id)} className="flex size-6 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Save">
                                    <Check className="size-3.5" />
                                  </button>
                                  <button onClick={() => setEditingFeedbackId(null)} className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Cancel">
                                    <X className="size-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => handleEditFeedback(fb)} className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300" title="Edit">
                                    <Pencil className="size-3" />
                                  </button>
                                  <button onClick={() => void handleDeleteFeedback(fb.id)} className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20" title="Delete">
                                    <Trash2 className="size-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {editingFeedbackId === fb.id ? (
                          <Textarea
                            value={editingFeedbackText}
                            onChange={(e) => setEditingFeedbackText(e.target.value)}
                            className="mt-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                            rows={3}
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400">{fb.body}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review history */}
              {p.reviews && p.reviews.length > 0 && !editing && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Review History</p>
                  <div className="space-y-1">
                    {p.reviews.map((rv) => (
                      <div key={rv.id} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${STATUS_CONFIG[rv.status].className}`}>
                          {STATUS_CONFIG[rv.status].label}
                        </span>
                        <span>by {rv.reviewer.firstName} {rv.reviewer.lastName}</span>
                        <span className="text-slate-400 dark:text-slate-500">· {formatDate(rv.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructor assets */}
              {isReviewer && !editing && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Project Assets</p>
                  {/* existing assets list */}
                  {(p.assets ?? []).length > 0 && (
                    <div className="mb-2 space-y-1.5">
                      {(p.assets ?? []).map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="size-4 shrink-0 text-slate-400" />
                            <a href={asset.url} download={asset.name} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-blue-600 hover:underline dark:text-blue-400">
                              {asset.name}
                            </a>
                            {asset.description && <span className="truncate text-xs text-slate-400">{asset.description}</span>}
                          </div>
                          <button onClick={() => void handleDeleteAsset(asset.id)} className="shrink-0 rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* upload new asset */}
                  <AssetUploader projectId={p.id} onUploaded={(asset) => { const merged = { ...p, assets: [...(p.assets ?? []), asset] }; setP(merged); onUpdate(merged); }} />
                </div>
              )}

              {/* Reviewer controls */}
              {isReviewer && p.status !== "DRAFT" && !editing && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Add Feedback</p>
                  <Textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Leave feedback for the student…"
                    className="mb-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void handleAddFeedback()} disabled={submitting || !feedbackText.trim()}>
                      <MessageSquare className="mr-1.5 size-3.5" /> Comment
                    </Button>
                    {p.status === "SUBMITTED" && (
                      <>
                        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void handleReview("APPROVED")} disabled={submitting}>
                          <CheckCircle2 className="mr-1.5 size-3.5" /> Approve
                        </Button>
                        <Button size="sm" className="bg-amber-500 text-white hover:bg-amber-600" onClick={() => void handleReview("NEEDS_WORK")} disabled={submitting}>
                          <Clock className="mr-1.5 size-3.5" /> Needs Work
                        </Button>
                        <Button size="sm" className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => void handleReview("REJECTED")} disabled={submitting}>
                          <XCircle className="mr-1.5 size-3.5" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Instructor-provided assets */}
              {!isReviewer && !editing && (p.assets ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Project Assets</p>
                  <div className="space-y-1.5">
                    {(p.assets ?? []).map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.url}
                        download={asset.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
                      >
                        <FileText className="size-4 shrink-0" />
                        <span className="truncate font-medium">{asset.name}</span>
                        {asset.description && <span className="shrink-0 text-xs text-blue-400">{asset.description}</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Student actions */}
              {!isReviewer && !editing && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {p.status === "APPROVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = `${window.location.origin}/showcase/${p.id}`;
                        void navigator.clipboard.writeText(url).then(() => toast.success("Public link copied!"));
                      }}
                    >
                      <Link2 className="mr-1.5 size-3.5" /> Copy Link
                    </Button>
                  )}
                  {canSubmit && (
                    <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
                      Submit for Review
                    </Button>
                  )}
                  {canRetract && (
                    <Button size="sm" variant="outline" onClick={() => void handleRetract()} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Undo2 className="mr-1.5 size-3.5" />}
                      Retract Submission
                    </Button>
                  )}
                  {(canEdit || p.status === "APPROVED" || p.status === "REJECTED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Trash2 className="mr-1.5 size-3.5" />}
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── New Project Form ──────────────────────────────────────────────────────────

function NewProjectForm({ programs, onCreated }: { programs: Program[]; onCreated: (p: Project) => void }) {
  const [form, setForm] = useState({ title: "", description: "", tags: "", programId: "", deployedUrl: "", howToUse: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, description: form.description || undefined, tags, programId: form.programId || undefined, deployedUrl: form.deployedUrl || undefined, howToUse: form.howToUse || undefined }),
    });
    if (res.ok) {
      const { project } = (await res.json()) as { project: Project };
      toast.success("Project created! Add your files below.");
      onCreated(project);
      setForm({ title: "", description: "", tags: "", programId: "", deployedUrl: "", howToUse: "" });
    } else {
      const err = (await res.json()) as { error?: string };
      toast.error(err.error ?? "Could not create project.");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">New Project</h3>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Title *</label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="My awesome project" required maxLength={120} className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description <span className="text-rose-400">*</span></label>
        <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What did you build? What did you learn?" rows={3} maxLength={2000} required className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">How to Use / Run <span className="text-slate-400">(optional)</span></label>
        <Textarea value={form.howToUse} onChange={(e) => setForm((f) => ({ ...f, howToUse: e.target.value }))} placeholder="How to run or use your project…" rows={2} maxLength={2000} className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tags <span className="text-slate-400">(comma separated)</span></label>
          <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="python, web, game" className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Live URL <span className="text-slate-400">(optional)</span></label>
          <Input type="url" value={form.deployedUrl} onChange={(e) => setForm((f) => ({ ...f, deployedUrl: e.target.value }))} placeholder="https://myproject.vercel.app" className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
      </div>

      {programs.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Link to Program <span className="text-slate-400">(optional)</span></label>
          <select value={form.programId} onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <option value="">Standalone project</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <Button type="submit" disabled={saving || !form.title.trim()}>
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
        Create Project
      </Button>
    </form>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ProjectsPanel({ role }: { role: UserRoleValue }) {
  const [tab, setTab] = useState<"mine" | "new" | "review">("mine");
  const [projects, setProjects] = useState<Project[]>([]);
  const [reviewProjects, setReviewProjects] = useState<Project[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  // Review queue filters + pagination
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState("SUBMITTED");
  const [reviewCursor, setReviewCursor] = useState<string | null>(null);
  const [reviewHasMore, setReviewHasMore] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const isReviewer = role === "INSTRUCTOR" || role === "ADMIN" || role === "SUPER_ADMIN";
  const canCreate = role === "STUDENT" || role === "FELLOW";
  const isParent = role === "PARENT";

  // Load own projects + programs
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [projRes, progRes] = await Promise.all([fetch("/api/projects"), fetch("/api/programs")]);
      if (projRes.ok) {
        const p = (await projRes.json()) as { projects?: Project[] };
        setProjects(p.projects ?? []);
      }
      if (progRes.ok) {
        const p = (await progRes.json()) as { programs?: Program[] };
        setPrograms(p.programs ?? []);
      }
      setLoading(false);
    };
    void load();
  }, []);

  // Review queue: re-fetch whenever search or status filter changes
  useEffect(() => {
    if (!isReviewer) return;
    const timer = setTimeout(() => {
      void (async () => {
        setReviewLoading(true);
        setReviewCursor(null);
        const params = new URLSearchParams({ paginate: "1" });
        if (reviewSearch.trim()) params.set("search", reviewSearch.trim());
        if (reviewStatus !== "all") params.set("status", reviewStatus);
        const res = await fetch(`/api/projects?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as { projects?: Project[]; hasMore?: boolean; nextCursor?: string | null };
          setReviewProjects(data.projects ?? []);
          setReviewHasMore(data.hasMore ?? false);
          setReviewCursor(data.nextCursor ?? null);
        }
        setReviewLoading(false);
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [reviewSearch, reviewStatus, isReviewer]);

  const handleLoadMoreReview = async () => {
    if (!reviewCursor || reviewLoading) return;
    setReviewLoading(true);
    const params = new URLSearchParams({ paginate: "1" });
    if (reviewSearch.trim()) params.set("search", reviewSearch.trim());
    if (reviewStatus !== "all") params.set("status", reviewStatus);
    params.set("cursor", reviewCursor);
    const res = await fetch(`/api/projects?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { projects?: Project[]; hasMore?: boolean; nextCursor?: string | null };
      setReviewProjects((prev) => [...prev, ...(data.projects ?? [])]);
      setReviewHasMore(data.hasMore ?? false);
      setReviewCursor(data.nextCursor ?? null);
    }
    setReviewLoading(false);
  };

  const handleUpdate = (updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setReviewProjects((prev) => {
      const matchesFilter = reviewStatus === "all" || updated.status === reviewStatus;
      if (matchesFilter) return prev.map((p) => (p.id === updated.id ? updated : p));
      return prev.filter((p) => p.id !== updated.id);
    });
  };

  const handleDelete = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setReviewProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev]);
    setTab("mine");
  };

  const tabs = [
    { key: "mine" as const, label: isParent ? "Children's Projects" : "My Projects", show: true },
    { key: "new" as const, label: "New Project", show: canCreate },
    { key: "review" as const, label: "Review Queue", show: isReviewer },
  ].filter((t) => t.show);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900 dark:text-slate-100">Projects</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{isParent ? "Track your children's project submissions and feedback" : "Build, showcase, and get feedback on your work"}</p>
        </div>
        <FolderOpen className="size-8 text-slate-300 dark:text-slate-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === t.key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* New project form */}
      {tab === "new" && canCreate && <NewProjectForm programs={programs} onCreated={handleCreated} />}

      {/* Review queue */}
      {tab === "review" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder="Search by title, tag, or student name…"
                className="pl-8 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:w-44"
            >
              <option value="all">All statuses</option>
              <option value="SUBMITTED">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="NEEDS_WORK">Needs Work</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Results */}
          {reviewLoading && reviewProjects.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : reviewProjects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
              <CheckCircle2 className="size-10 text-emerald-300 dark:text-emerald-700" />
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {reviewSearch ? "No projects match your search" : "All caught up — no projects pending review"}
              </p>
            </div>
          ) : (
            <>
              {reviewProjects.map((p) => (
                <ProjectCard key={p.id} project={p} isReviewer={true} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
              {reviewHasMore && (
                <div className="flex justify-center pt-1">
                  <Button variant="outline" size="sm" onClick={() => void handleLoadMoreReview()} disabled={reviewLoading}>
                    {reviewLoading ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              )}
              {reviewLoading && reviewProjects.length > 0 && (
                <div className="flex justify-center py-2">
                  <Loader2 className="size-5 animate-spin text-slate-400" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* My projects — grouped by status (or by child for parents) */}
      {tab === "mine" && (
        <div className="space-y-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
              <FolderOpen className="size-10 text-slate-300 dark:text-slate-600" />
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">{isParent ? "No projects from your children yet" : "No projects yet"}</p>
                {canCreate && <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Click <strong>New Project</strong> to get started</p>}
              </div>
            </div>
          ) : isParent ? (
            // Group by child
            (() => {
              const byChild = new Map<string, { name: string; projects: Project[] }>();
              for (const p of projects) {
                const childId = p.student?.id ?? "unknown";
                const name = p.student ? `${p.student.firstName} ${p.student.lastName}` : "Unknown";
                if (!byChild.has(childId)) byChild.set(childId, { name, projects: [] });
                byChild.get(childId)!.projects.push(p);
              }
              return Array.from(byChild.entries()).map(([childId, { name, projects: childProjects }]) => (
                <div key={childId}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{name}</h3>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {childProjects.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {childProjects.map((p) => (
                      <ProjectCard key={p.id} project={p} isReviewer={false} onUpdate={handleUpdate} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              ));
            })()
          ) : (
            STATUS_GROUPS.map(({ label, statuses, emptyText }) => {
              const group = projects.filter((p) => statuses.includes(p.status));
              if (group.length === 0 && !emptyText) return null;
              return (
                <div key={label}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</h3>
                    {group.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {group.length}
                      </span>
                    )}
                  </div>
                  {group.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{emptyText}</p>
                  ) : (
                    <div className="space-y-3">
                      {group.map((p) => (
                        <ProjectCard key={p.id} project={p} isReviewer={false} onUpdate={handleUpdate} onDelete={handleDelete} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
