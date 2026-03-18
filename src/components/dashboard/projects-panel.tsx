"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRoleValue } from "@/lib/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectFile = { id: string; name: string; mimeType: string; size: number; url: string };
type FeedbackItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; role: string };
};
type Project = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "NEEDS_WORK" | "REJECTED";
  visibility: "PRIVATE" | "PUBLIC";
  deployedUrl: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  program: { id: string; name: string } | null;
  files: ProjectFile[];
  feedback: FeedbackItem[];
  student?: { id: string; firstName: string; lastName: string };
};
type Program = { id: string; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  SUBMITTED: {
    label: "Submitted",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  NEEDS_WORK: {
    label: "Needs Work",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── File Upload ───────────────────────────────────────────────────────────────

function FileUploader({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: (file: ProjectFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];

    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Get presigned URL
      const urlRes = await fetch(`/api/projects/${projectId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
      if (!urlRes.ok) {
        const err = (await urlRes.json()) as { error?: string };
        toast.error(err?.error ?? "Could not get upload URL.");
        return;
      }
      const { uploadUrl, key, publicUrl } = (await urlRes.json()) as {
        uploadUrl: string;
        key: string;
        publicUrl: string;
      };

      // Step 2: Upload directly to R2
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () =>
          xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      // Step 3: Confirm upload in DB
      const confirmRes = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          storageKey: key,
          url: publicUrl,
        }),
      });
      if (!confirmRes.ok) {
        toast.error("Could not save file record.");
        return;
      }
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
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500 dark:hover:bg-blue-900/10"
      >
        {uploading ? (
          <>
            <Loader2 className="size-6 animate-spin text-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Uploading… {progress}%
            </span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Upload className="size-6 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Click to upload a file
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Images, videos, PDFs, ZIPs, code • Max 50 MB
            </span>
          </>
        )}
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
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localProject, setLocalProject] = useState(project);
  const cfg = STATUS_CONFIG[localProject.status];

  const canEdit = localProject.status === "DRAFT" || localProject.status === "NEEDS_WORK";
  const canSubmit = canEdit && localProject.files.length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/projects/${localProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SUBMITTED" }),
    });
    if (res.ok) {
      const { project: updated } = (await res.json()) as { project: Project };
      setLocalProject(updated);
      onUpdate(updated);
      toast.success("Project submitted for review!");
    } else {
      toast.error("Could not submit project.");
    }
    setSubmitting(false);
  };

  const handleReview = async (status: "APPROVED" | "NEEDS_WORK" | "REJECTED") => {
    setSubmitting(true);
    const res = await fetch(`/api/projects/${localProject.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const { project: updated } = (await res.json()) as { project: Project };
      const merged = { ...localProject, status: updated.status };
      setLocalProject(merged);
      onUpdate(merged);
      toast.success(`Project marked as ${status.replace("_", " ").toLowerCase()}.`);
    } else {
      toast.error("Could not update status.");
    }
    setSubmitting(false);
  };

  const handleAddFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/projects/${localProject.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: feedbackText.trim() }),
    });
    if (res.ok) {
      const { feedback } = (await res.json()) as { feedback: FeedbackItem };
      const merged = { ...localProject, feedback: [...localProject.feedback, feedback] };
      setLocalProject(merged);
      onUpdate(merged);
      setFeedbackText("");
      toast.success("Feedback added.");
    } else {
      toast.error("Could not add feedback.");
    }
    setSubmitting(false);
  };

  const handleDeleteFile = async (fileId: string) => {
    const res = await fetch(`/api/projects/${localProject.id}/files/${fileId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const merged = {
        ...localProject,
        files: localProject.files.filter((f) => f.id !== fileId),
      };
      setLocalProject(merged);
      onUpdate(merged);
      toast.success("File removed.");
    } else {
      toast.error("Could not remove file.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${localProject.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete(localProject.id);
      toast.success("Project deleted.");
    } else {
      toast.error("Could not delete project.");
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
            >
              {cfg.label}
            </span>
            {localProject.program && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {localProject.program.name}
              </span>
            )}
            {localProject.student && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {localProject.student.firstName} {localProject.student.lastName}
              </span>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
            {localProject.title}
          </h3>
          {localProject.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {localProject.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span>
              {localProject.files.length} file{localProject.files.length !== 1 ? "s" : ""}
            </span>
            <span>
              {localProject.feedback.length} comment
              {localProject.feedback.length !== 1 ? "s" : ""}
            </span>
            <span>{formatDate(localProject.updatedAt)}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
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
              {/* Description */}
              {localProject.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {localProject.description}
                </p>
              )}

              {/* Deployed URL */}
              {localProject.deployedUrl && (
                <a
                  href={localProject.deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink className="size-3.5" /> View live project
                </a>
              )}

              {/* Files */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Files
                </p>
                {localProject.files.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">No files yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {localProject.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-slate-400" />
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sm text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {file.name}
                          </a>
                          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                            {formatBytes(file.size)}
                          </span>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => void handleDeleteFile(file.id)}
                            className="shrink-0 rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload area */}
                {canEdit && localProject.files.length < 10 && (
                  <div className="mt-2">
                    <FileUploader
                      projectId={localProject.id}
                      onUploaded={(f) => {
                        const merged = { ...localProject, files: [...localProject.files, f] };
                        setLocalProject(merged);
                        onUpdate(merged);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Feedback */}
              {localProject.feedback.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Feedback
                  </p>
                  <div className="space-y-2">
                    {localProject.feedback.map((fb) => (
                      <div key={fb.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {fb.author.firstName} {fb.author.lastName}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {formatDate(fb.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{fb.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewer feedback form */}
              {isReviewer && localProject.status !== "DRAFT" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Add Feedback
                  </p>
                  <Textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Leave feedback for the student..."
                    className="mb-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleAddFeedback()}
                      disabled={submitting || !feedbackText.trim()}
                    >
                      <MessageSquare className="mr-1.5 size-3.5" /> Add Comment
                    </Button>
                    {localProject.status === "SUBMITTED" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => void handleReview("APPROVED")}
                          disabled={submitting}
                        >
                          <CheckCircle2 className="mr-1.5 size-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          className="bg-amber-500 text-white hover:bg-amber-600"
                          onClick={() => void handleReview("NEEDS_WORK")}
                          disabled={submitting}
                        >
                          <Clock className="mr-1.5 size-3.5" /> Needs Work
                        </Button>
                        <Button
                          size="sm"
                          className="bg-rose-600 text-white hover:bg-rose-700"
                          onClick={() => void handleReview("REJECTED")}
                          disabled={submitting}
                        >
                          <XCircle className="mr-1.5 size-3.5" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Submit / Delete actions for owner */}
              {!isReviewer && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {canSubmit && (
                    <Button
                      size="sm"
                      onClick={() => void handleSubmit()}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <Upload className="mr-1.5 size-3.5" />
                      )}
                      Submit for Review
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 size-3.5" />
                      )}
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

function NewProjectForm({
  programs,
  onCreated,
}: {
  programs: Program[];
  onCreated: (p: Project) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    programId: "",
    deployedUrl: "",
    visibility: "PRIVATE" as "PRIVATE" | "PUBLIC",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        tags,
        programId: form.programId || undefined,
        deployedUrl: form.deployedUrl || undefined,
        visibility: form.visibility,
      }),
    });
    if (res.ok) {
      const { project } = (await res.json()) as { project: Project };
      toast.success("Project created! Add your files below.");
      onCreated(project);
      setForm({
        title: "",
        description: "",
        tags: "",
        programId: "",
        deployedUrl: "",
        visibility: "PRIVATE",
      });
    } else {
      toast.error("Could not create project.");
    }
    setSaving(false);
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
    >
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">New Project</h3>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Title *
        </label>
        <Input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="My awesome project"
          required
          maxLength={120}
          className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Description
        </label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What did you build? What did you learn?"
          rows={3}
          maxLength={2000}
          className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tags <span className="text-slate-400">(comma separated)</span>
          </label>
          <Input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="python, web, game"
            className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Live URL <span className="text-slate-400">(optional)</span>
          </label>
          <Input
            type="url"
            value={form.deployedUrl}
            onChange={(e) => setForm((f) => ({ ...f, deployedUrl: e.target.value }))}
            placeholder="https://myproject.vercel.app"
            className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {programs.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Link to Program <span className="text-slate-400">(optional)</span>
          </label>
          <select
            value={form.programId}
            onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Standalone project</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Visibility
        </label>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          {(["PRIVATE", "PUBLIC"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setForm((f) => ({ ...f, visibility: v }))}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                form.visibility === v
                  ? "bg-[#0D1F45] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {v === "PRIVATE" ? "🔒 Private" : "🌍 Public"}
            </button>
          ))}
        </div>
      </div>

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

  const isReviewer = role === "INSTRUCTOR" || role === "ADMIN" || role === "SUPER_ADMIN";
  const canCreate = role === "STUDENT" || role === "FELLOW";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [projRes, progRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/programs"),
      ]);
      if (projRes.ok) {
        const p = (await projRes.json()) as { projects?: Project[] };
        setProjects(p.projects ?? []);
      }
      if (progRes.ok) {
        const p = (await progRes.json()) as { programs?: Program[] };
        setPrograms(p.programs ?? []);
      }

      if (isReviewer) {
        const rRes = await fetch("/api/projects?status=SUBMITTED");
        if (rRes.ok) {
          const p = (await rRes.json()) as { projects?: Project[] };
          setReviewProjects(p.projects ?? []);
        }
      }
      setLoading(false);
    };
    void load();
  }, [isReviewer]);

  const handleUpdate = (updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setReviewProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    // Remove from review queue if no longer SUBMITTED
    if (updated.status !== "SUBMITTED") {
      setReviewProjects((prev) => prev.filter((p) => p.id !== updated.id));
    }
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
    { key: "mine" as const, label: "My Projects", show: true },
    { key: "new" as const, label: "New Project", show: canCreate },
    {
      key: "review" as const,
      label: `Review Queue${reviewProjects.length ? ` (${reviewProjects.length})` : ""}`,
      show: isReviewer,
    },
  ].filter((t) => t.show);

  const currentList = tab === "review" ? reviewProjects : projects;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900 dark:text-slate-100">
            Projects
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Build, showcase, and get feedback on your work
          </p>
        </div>
        <FolderOpen className="size-8 text-slate-300 dark:text-slate-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* New project form */}
      {tab === "new" && canCreate && (
        <NewProjectForm programs={programs} onCreated={handleCreated} />
      )}

      {/* Project list */}
      {tab !== "new" && (
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : currentList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
              <FolderOpen className="size-10 text-slate-300 dark:text-slate-600" />
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {tab === "review" ? "No projects pending review" : "No projects yet"}
                </p>
                {canCreate && tab === "mine" && (
                  <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                    Click <strong>New Project</strong> to get started
                  </p>
                )}
              </div>
            </div>
          ) : (
            currentList.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                isReviewer={isReviewer && tab === "review"}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
