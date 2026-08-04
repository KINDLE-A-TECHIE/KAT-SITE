"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Maximize2, Minimize2 } from "lucide-react";
import { useFullscreen, FULLSCREEN_PANEL_CLASS, FULLSCREEN_BACKDROP_CLASS } from "@/components/dashboard/use-fullscreen";
import {
  SCRATCH_MSG,
  getScratchEditorUrl,
  isScratchEnabled,
  scratchEditorOrigin,
  isTrustedScratchMessage,
  parseScratchInbound,
  loadMessage,
  saveMessage,
} from "@/lib/scratch";

/**
 * The Scratch editor as an ASSESSMENT answer. Same self-hosted editor + postMessage bridge as the lesson
 * ScratchBlock, but keyed by questionId (not a lesson content), with no completion/draft: it reports the
 * saved .sb3 key UP to the take, which sends it as the answer on submit. The server then fetches that .sb3
 * and grades it (see scratch-analysis.ts). Save/open come from the editor's own File menu.
 */

const DISCLAIMER = "Based on Scratch from the MIT Media Lab (scratch.mit.edu). Not affiliated with or endorsed by Scratch.";

export function ScratchAnswer({
  questionId,
  savedKey,
  onSavedKey,
}: {
  questionId: string;
  savedKey: string | null;
  onSavedKey: (key: string) => void;
}) {
  const editorOrigin = scratchEditorOrigin();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const savedKeyRef = useRef<string | null>(savedKey);
  const loadedOnceRef = useRef(false);

  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(Boolean(savedKey));
  const [fullscreen, setFullscreen] = useState(false);
  const exitFullscreen = useCallback(() => setFullscreen(false), []);
  useFullscreen(fullscreen, exitFullscreen);

  const post = useCallback(
    (message: unknown) => {
      if (editorOrigin) iframeRef.current?.contentWindow?.postMessage(message, editorOrigin);
    },
    [editorOrigin],
  );

  useEffect(() => {
    const url = getScratchEditorUrl();
    if (url) setSrc(`${url}?parent=${encodeURIComponent(window.location.origin)}`);
  }, []);

  const sendLoad = useCallback(async () => {
    const key = savedKeyRef.current;
    if (!key) {
      post(loadMessage(null));
      return;
    }
    try {
      const res = await fetch(`/api/assessments/scratch/download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = res.ok ? ((await res.json()) as { projectUrl?: string }) : {};
      post(loadMessage(data.projectUrl ?? null));
    } catch {
      post(loadMessage(null));
    }
  }, [post]);

  const sendSave = useCallback(async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assessments/scratch/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (!res.ok) throw new Error("upload-url failed");
      const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };
      post(saveMessage(uploadUrl, key));
    } catch {
      setSaving(false);
      toast.error("Could not start the save. Please try again.");
    }
  }, [ready, saving, questionId, post]);

  const handleSaved = useCallback(
    (key: string) => {
      savedKeyRef.current = key;
      setDirty(false);
      setSaving(false);
      setSavedOnce(true);
      onSavedKey(key);
    },
    [onSavedKey],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedScratchMessage(event, editorOrigin)) return;
      const msg = parseScratchInbound(event.data);
      if (!msg) return;
      switch (msg.type) {
        case SCRATCH_MSG.READY:
          setReady(true);
          break;
        case SCRATCH_MSG.DIRTY:
          setDirty(true);
          break;
        case SCRATCH_MSG.SAVED:
          handleSaved(msg.key);
          break;
        case SCRATCH_MSG.SAVE_FAILED:
          setSaving(false);
          toast.error(msg.message || "Could not save your project.");
          break;
        case SCRATCH_MSG.REQUEST_SAVE:
          void sendSave();
          break;
        case SCRATCH_MSG.REQUEST_LOAD:
          void sendLoad();
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editorOrigin, handleSaved, sendSave, sendLoad]);

  // Auto-resume any already-saved answer once the editor is ready.
  useEffect(() => {
    if (!ready || loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    void sendLoad();
  }, [ready, sendLoad]);

  if (!isScratchEnabled()) {
    return (
      <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900">
        The Scratch editor is not available right now.
      </p>
    );
  }

  const status = !ready
    ? "Loading the editor…"
    : dirty
      ? "Unsaved changes. Use File then Save."
      : savedOnce
        ? "Answer saved."
        : "Build it, then save with File then Save.";

  return (
    <>
      {fullscreen ? <div className={FULLSCREEN_BACKDROP_CLASS} onClick={exitFullscreen} /> : null}
      <div className={fullscreen ? `${FULLSCREEN_PANEL_CLASS} gap-3` : "space-y-2"}>
        {src ? (
          <iframe
            ref={iframeRef}
            src={src}
            title="Scratch editor"
            allow="fullscreen; autoplay"
            className={`w-full rounded-xl border border-stone-200 bg-white dark:border-stone-800 ${fullscreen ? "min-h-0 flex-1" : "h-[32rem]"}`}
          />
        ) : (
          <div className={`w-full animate-pulse rounded-xl bg-stone-100 dark:bg-stone-900 ${fullscreen ? "flex-1" : "h-[32rem]"}`} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/40"
          >
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <span className={`text-xs ${savedOnce && !dirty ? "text-emerald-600 dark:text-emerald-400" : "text-stone-500 dark:text-stone-400"}`}>{status}</span>
        </div>

        {!fullscreen ? (
          <p className="text-[11px] text-stone-400 dark:text-stone-500">
            Save your project with <span className="font-medium text-stone-500 dark:text-stone-400">File then Save</span> in the editor before you submit. {DISCLAIMER}
          </p>
        ) : null}
      </div>
    </>
  );
}
