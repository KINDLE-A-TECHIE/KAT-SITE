"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { zipSync } from "fflate";
import {
  AlertCircle, CheckCircle2, Clock, ExternalLink, FileArchive,
  FilePlus, FolderOpen, Loader2, MessageSquare, Paperclip,
  RefreshCw, Send, Upload, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

type FeedbackItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { firstName: string; lastName: string; role: string };
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "NEEDS_WORK" | "REJECTED";
  deployedUrl: string | null;
  updatedAt: string;
  files: ProjectFile[];
  feedback: FeedbackItem[];
};

export type AssessmentForProject = {
  id: string;
  title: string;
  description: string | null;
  totalPoints: number;
  passScore: number;
  dueDate: string | null;
  program: { id: string; name: string };
  module?: { id: string; title: string } | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<Project["status"], { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:      { label: "Draft",        color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",           icon: <Clock className="h-3.5 w-3.5" /> },
  SUBMITTED:  { label: "Under Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",            icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  APPROVED:   { label: "Approved ✓",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  NEEDS_WORK: { label: "Needs Work",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",        icon: <RefreshCw className="h-3.5 w-3.5" /> },
  REJECTED:   { label: "Rejected",     color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",            icon: <XCircle className="h-3.5 w-3.5" /> },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectAssessmentView({ assessment }: { assessment: AssessmentForProject }) {
  // Data
  const [loading, setLoading]   = useState(true);
  const [project, setProject]   = useState<Project | null>(null);

  // Form state (create or edit)
  const [formOpen, setFormOpen]       = useState(false);
  const [formTitle, setFormTitle]     = useState("");
  const [formDesc, setFormDesc]       = useState("");
  const [formUrl, setFormUrl]         = useState("");
  const [savingForm, setSavingForm]   = useState(false);

  // File upload
  const [uploadMsg, setUploadMsg]         = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading]         = useState(false);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // webkitdirectory — set imperatively
  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.setAttribute("webkitdirectory", "");
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadProject = async () => {
    try {
      const res = await fetch(`/api/projects?assessmentId=${assessment.id}`);
      if (!res.ok) return;
      const data = await res.json() as { projects: Project[] };
      setProject(data.projects[0] ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProject(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setFormTitle("");
    setFormDesc("");
    setFormUrl("");
    setFormOpen(true);
  };

  const openEditForm = () => {
    if (!project) return;
    setFormTitle(project.title);
    setFormDesc(project.description ?? "");
    setFormUrl(project.deployedUrl ?? "");
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!formTitle.trim()) { toast.error("Project title is required."); return; }
    if (formDesc.trim().length < 10) { toast.error("Description must be at least 10 characters."); return; }
    setSavingForm(true);
    try {
      if (!project) {
        // Create
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:        formTitle.trim(),
            description:  formDesc.trim(),
            deployedUrl:  formUrl.trim() || undefined,
            assessmentId: assessment.id,
            programId:    assessment.program.id,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          toast.error(err.error ?? "Could not create project.");
          return;
        }
        const { project: created } = (await res.json()) as { project: Project };
        setProject({ ...created, files: [], feedback: [] });
        toast.success("Project saved.");
      } else {
        // Update
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       formTitle.trim(),
            description: formDesc.trim(),
            deployedUrl: formUrl.trim() || "",
          }),
        });
        if (!res.ok) { toast.error("Could not update project."); return; }
        const { project: updated } = (await res.json()) as { project: Project };
        setProject((prev) => ({ ...(prev!), ...updated }));
        toast.success("Project updated.");
      }
      setFormOpen(false);
    } finally {
      setSavingForm(false);
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────────

  const uploadToProject = async (blob: Blob, name: string, mimeType: string) => {
    if (!project) return;
    const urlRes = await fetch(`/api/projects/${project.id}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType, size: blob.size }),
    });
    if (!urlRes.ok) {
      const err = (await urlRes.json()) as { error?: string };
      throw new Error(err.error ?? "Could not get upload URL.");
    }
    const { uploadUrl, key, publicUrl } = (await urlRes.json()) as {
      uploadUrl: string; key: string; publicUrl: string;
    };

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });
    await new Promise<void>((resolve, reject) => {
      xhr.onload  = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", mimeType);
      xhr.send(blob);
    });

    const confirmRes = await fetch(`/api/projects/${project.id}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType, size: blob.size, storageKey: key, url: publicUrl }),
    });
    if (!confirmRes.ok) throw new Error("Could not register file.");
    const { file: saved } = (await confirmRes.json()) as { file: ProjectFile };
    return saved;
  };

  const handleFileInput = async (files: FileList | null) => {
    if (!files?.length || !project) return;
    const file = files[0]!;
    setUploading(true);
    setUploadProgress(0);
    setUploadMsg(`Uploading ${file.name}…`);
    try {
      const saved = await uploadToProject(file, file.name, file.type || "application/octet-stream");
      if (saved) {
        setProject((prev) => prev ? { ...prev, files: [...prev.files, saved] } : null);
        toast.success(`${file.name} uploaded.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadMsg("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFolderInput = async (files: FileList | null) => {
    const all = Array.from(files ?? []).filter((f) => !f.name.startsWith(".") && f.size > 0);
    if (!all.length || !project) return;

    const folderName = (all[0]!.webkitRelativePath.split("/")[0] ?? "source")
      .replace(/[^a-zA-Z0-9._-]/g, "-");
    const zipName = `${folderName}.zip`;

    setUploading(true);
    setUploadProgress(0);
    setUploadMsg(`Zipping ${all.length} file(s)…`);
    try {
      const encoder = new TextEncoder();
      const entries: Record<string, Uint8Array> = {};
      for (const f of all) {
        const rawPath = f.webkitRelativePath || f.name;
        const parts = rawPath.split("/");
        const rel = parts.length > 1 ? parts.slice(1).join("/") : parts[0]!;
        if (!rel) continue;
        entries[rel] = encoder.encode(await f.text());
      }
      const zipped = zipSync(entries, { level: 6 });
      const zipBlob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });

      setUploadMsg(`Uploading ${zipName}…`);
      const saved = await uploadToProject(zipBlob, zipName, "application/zip");
      if (saved) {
        setProject((prev) => prev ? { ...prev, files: [...prev.files, saved] } : null);
        toast.success(`${zipName} uploaded (${all.length} file(s)).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadMsg("");
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const submitProject = async () => {
    if (!project) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });
      if (!res.ok) { toast.error("Could not submit project."); return; }
      const { project: updated } = (await res.json()) as { project: Project };
      setProject((prev) => prev ? { ...prev, status: updated.status } : null);
      toast.success("Submitted for review! Your instructor will be notified.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mt-3 space-y-2">
        <div className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  const canEdit  = !project || project.status === "DRAFT" || project.status === "NEEDS_WORK";
  const canSubmit = project && (project.status === "DRAFT" || project.status === "NEEDS_WORK");
  const meta     = project ? STATUS_META[project.status] : null;

  return (
    <div className="mt-3 space-y-3">

      {/* ── Assessment brief ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Project Assessment
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Pass: {assessment.passScore}/{assessment.totalPoints} pts</span>
            {assessment.dueDate && (
              <span className="text-amber-600 dark:text-amber-400">
                Due {formatDate(assessment.dueDate)}
              </span>
            )}
          </div>
        </div>
        {assessment.description && (
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {assessment.description}
          </p>
        )}
      </div>

      {/* ── Status card (project exists) ──────────────────────────────────── */}
      {project && (
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">{project.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Last updated {formatDate(project.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {meta && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
                  {meta.icon}
                  {meta.label}
                </span>
              )}
              {canEdit && (
                <button
                  onClick={openEditForm}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Deployed URL */}
          {project.deployedUrl && (
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <a
                href={project.deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {project.deployedUrl}
              </a>
            </div>
          )}

          {/* Files */}
          {project.files.length > 0 && (
            <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Attached Files
              </p>
              <div className="space-y-1">
                {project.files.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md p-1.5 text-xs text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {f.mimeType === "application/zip" ? (
                      <FileArchive className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-slate-400">{formatBytes(f.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* File upload (only on editable states) */}
          {canEdit && (
            <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleFileInput(e.target.files)}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleFolderInput(e.target.files)}
              />

              {uploading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  <span>{uploadMsg} {uploadProgress > 0 ? `${uploadProgress}%` : ""}</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
                  >
                    <Upload className="h-3.5 w-3.5" /> Attach file
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Upload folder
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:hover:text-slate-300"
                  >
                    <FilePlus className="h-3.5 w-3.5" /> Add file
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Instructor feedback */}
          {project.feedback.length > 0 && (
            <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Instructor Feedback
              </p>
              <div className="space-y-2">
                {project.feedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <MessageSquare className="h-3 w-3" />
                      <span className="font-medium">{fb.author.firstName} {fb.author.lastName}</span>
                      <span>·</span>
                      <span>{formatDate(fb.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{fb.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APPROVED — gate passed */}
          {project.status === "APPROVED" && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Project approved — <strong>project gate passed</strong> for this module.
              </span>
            </div>
          )}

          {/* Submit / Resubmit button */}
          {canSubmit && (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              {project.status === "NEEDS_WORK" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Address the feedback above, then resubmit.
                </p>
              )}
              <Button
                size="sm"
                className="ml-auto gap-1.5 bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
                onClick={() => void submitProject()}
              >
                {submitting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</>
                ) : project.status === "NEEDS_WORK" ? (
                  <><RefreshCw className="h-3.5 w-3.5" /> Resubmit for Review</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Submit for Review</>
                )}
              </Button>
            </div>
          )}

          {/* SUBMITTED — waiting */}
          {project.status === "SUBMITTED" && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Your instructor will review and provide feedback soon.
            </div>
          )}
        </div>
      )}

      {/* ── Edit / Create form ──────────────────────────────────────────────── */}
      {formOpen && (
        <div className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {project ? "Edit Project" : "Create Your Project"}
          </p>
          <input
            type="text"
            placeholder="Project title (e.g. Calculator App)"
            maxLength={120}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <textarea
            placeholder="Describe what your project does, how you built it, what you learned… (min. 10 characters)"
            maxLength={2000}
            rows={3}
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <input
            type="url"
            placeholder="Live demo or repository URL (optional)"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={savingForm}
              onClick={() => void saveForm()}
              className="gap-1.5"
            >
              {savingForm
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : "Save Project"}
            </Button>
            <button
              onClick={() => setFormOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Start project CTA (no project yet, form not open) ─────────────── */}
      {!project && !formOpen && (
        <button
          onClick={openCreateForm}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-4 text-sm font-medium text-slate-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          <FilePlus className="h-4 w-4" />
          Start your project submission
        </button>
      )}
    </div>
  );
}
