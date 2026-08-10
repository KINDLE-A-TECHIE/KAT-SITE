"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Download, Film } from "lucide-react";

type Recording = {
  id: string;
  contentId: string | null;
  title: string | null;
  sizeBytes: number;
  durationMs: number | null;
  createdAt: string;
  url: string;
};

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Lists the current user's saved stage recordings, newest first. With `contentId` it shows only the clips
 * made in that lesson/assessment (the "tied" view under a Scratch block); without it, the full personal
 * library. Bump `reloadSignal` to refetch after a new recording is saved. Each row plays inline, downloads,
 * or deletes (owner-only, enforced server-side).
 */
export function StageRecordingsPanel({
  contentId,
  reloadSignal = 0,
  heading = "Your recordings",
  embed = false,
}: {
  contentId?: string;
  reloadSignal?: number;
  heading?: string;
  // In the school iframe embed, list/delete go to the embed-session-authed routes instead of NextAuth.
  embed?: boolean;
}) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const base = embed ? "/api/school/embed/videos" : "/api/videos";

  const load = useCallback(async () => {
    try {
      const qs = contentId ? `?contentId=${encodeURIComponent(contentId)}` : "";
      const res = await fetch(`${base}${qs}`);
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { recordings: Recording[] };
      setRecordings(data.recordings);
    } catch {
      setRecordings([]);
    }
  }, [contentId, base]);

  useEffect(() => {
    void load();
  }, [load, reloadSignal]);

  const remove = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`${base}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setRecordings((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch {
      toast.error("Could not delete that recording.");
    } finally {
      setDeleting(null);
    }
  }, [base]);

  if (recordings === null) {
    return <div className="h-20 w-full animate-pulse rounded-xl bg-stone-100 dark:bg-stone-900" />;
  }
  if (recordings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-4 text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-900/40 dark:text-stone-400">
        No saved recordings yet. Record the stage, then choose <span className="font-medium">Save to my account</span>.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-200">
        <Film className="size-4 text-stone-400" />
        {heading}
        <span className="text-xs font-normal text-stone-400">({recordings.length})</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {recordings.map((r) => (
          <li
            key={r.id}
            className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900/40"
          >
            <video controls preload="metadata" src={r.url} className="aspect-video w-full bg-black" />
            <div className="flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0 text-xs text-stone-500 dark:text-stone-400">
                <p className="truncate font-medium text-stone-700 dark:text-stone-200">
                  {r.title || new Date(r.createdAt).toLocaleDateString()}
                </p>
                <p>
                  {[formatDuration(r.durationMs), formatSize(r.sizeBytes)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={r.url}
                  download
                  title="Download"
                  className="rounded-md p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800/60"
                >
                  <Download className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  disabled={deleting === r.id}
                  title="Delete"
                  className="rounded-md p-1.5 text-stone-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-stone-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
