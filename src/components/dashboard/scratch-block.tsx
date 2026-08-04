"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Maximize2, Minimize2 } from "lucide-react";
import { getDraft, putDraft } from "@/lib/lesson-block-draft";
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
 * SCRATCH lesson block: embeds the self-hosted Scratch editor (a KAT-controlled origin, see 3a) in an
 * iframe and drives it over the postMessage contract in @/lib/scratch. The pupil builds a project, saves
 * it (the .sb3 goes browser -> R2 directly via a presigned PUT; the bytes never touch our server), and
 * resumes it next time. Only the R2 KEY is stored, in the shared per-user LessonBlockDraft. First save
 * marks the block complete (participation), like the other interactive blocks.
 *
 * Dark until NEXT_PUBLIC_SCRATCH_EDITOR_URL is set (isScratchEnabled). Config rides LessonContent.body as
 * optional JSON { prompt? }.
 */

type ScratchConfig = { prompt?: string };

function parseConfig(body: string | null): ScratchConfig {
  if (!body || !body.trim()) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? (parsed as ScratchConfig) : {};
  } catch {
    return {};
  }
}

const DISCLAIMER = "Based on Scratch from the MIT Media Lab (scratch.mit.edu). Not affiliated with or endorsed by Scratch.";

export function ScratchBlock({
  contentId,
  body,
  onComplete,
}: {
  contentId: string;
  body: string | null;
  onComplete?: () => void;
}) {
  const config = parseConfig(body);
  const editorOrigin = scratchEditorOrigin();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const savedKeyRef = useRef<string | null>(null);
  const loadedOnceRef = useRef(false);
  const completedRef = useRef(false);

  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Whether a project has ever been saved (from a prior session or this one), so the status line can tell
  // "no changes yet" apart from "saved".
  const [hasSaved, setHasSaved] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const exitFullscreen = useCallback(() => setFullscreen(false), []);
  useFullscreen(fullscreen, exitFullscreen);

  const post = useCallback(
    (message: unknown) => {
      if (editorOrigin) iframeRef.current?.contentWindow?.postMessage(message, editorOrigin);
    },
    [editorOrigin],
  );

  // Build the iframe src on the client (needs window.origin for the ?parent handshake the bridge checks).
  useEffect(() => {
    const url = getScratchEditorUrl();
    if (url) setSrc(`${url}?parent=${encodeURIComponent(window.location.origin)}`);
  }, []);

  // Load this user's saved project key (if any) from the shared draft store.
  useEffect(() => {
    void (async () => {
      const draft = await getDraft<{ sb3Key?: string }>(contentId);
      if (draft?.sb3Key) {
        savedKeyRef.current = draft.sb3Key;
        setHasSaved(true);
      }
      setDraftLoaded(true);
    })();
  }, [contentId]);

  const handleSaved = useCallback(
    async (key: string) => {
      savedKeyRef.current = key;
      setDirty(false);
      setSaving(false);
      setHasSaved(true);
      await putDraft(contentId, { sb3Key: key });
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    },
    [contentId, onComplete],
  );

  // Send the pupil's saved project (or a blank one) into the editor. Used to auto-resume on open, and
  // when the pupil chooses File -> Open my project (revert to the last save).
  const sendLoad = useCallback(async () => {
    const key = savedKeyRef.current;
    if (!key) {
      post(loadMessage(null)); // blank project
      return;
    }
    try {
      const res = await fetch(`/api/curriculum/contents/${contentId}/scratch/download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = res.ok ? ((await res.json()) as { projectUrl?: string }) : {};
      post(loadMessage(data.projectUrl ?? null));
    } catch {
      post(loadMessage(null));
    }
  }, [contentId, post]);

  // Mint a presigned upload URL and hand it to the editor, which serializes the project and PUTs it to R2,
  // then replies SAVED{key} or SAVE_FAILED. Triggered by the editor's File -> Save.
  const sendSave = useCallback(async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/curriculum/contents/${contentId}/scratch/upload-url`, { method: "POST" });
      if (!res.ok) throw new Error("upload-url failed");
      const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };
      post(saveMessage(uploadUrl, key));
    } catch {
      setSaving(false);
      toast.error("Could not start the save. Please try again.");
    }
  }, [ready, saving, contentId, post]);

  // Editor -> parent messages. Origin-pinned; a stray message from any other frame is ignored.
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
          void handleSaved(msg.key);
          break;
        case SCRATCH_MSG.SAVE_FAILED:
          setSaving(false);
          toast.error(msg.message || "Could not save your project.");
          break;
        case SCRATCH_MSG.REQUEST_SAVE: // pupil chose File -> Save
          void sendSave();
          break;
        case SCRATCH_MSG.REQUEST_LOAD: // pupil chose File -> Open my project
          void sendLoad();
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editorOrigin, handleSaved, sendSave, sendLoad]);

  // Auto-resume: once the editor is ready AND we know whether there is a saved project, load it exactly
  // once. Ordering on both flags avoids a race where READY arrives before the draft has been read.
  useEffect(() => {
    if (!ready || !draftLoaded || loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    void sendLoad();
  }, [ready, draftLoaded, sendLoad]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
      ? "You have unsaved changes."
      : hasSaved
        ? "Your work is saved."
        : "Ready. Build something, then save.";

  return (
    <>
      {fullscreen ? <div className={FULLSCREEN_BACKDROP_CLASS} onClick={exitFullscreen} /> : null}
      <div className={fullscreen ? `${FULLSCREEN_PANEL_CLASS} gap-3` : "space-y-3"}>
        {config.prompt && !fullscreen ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">{config.prompt}</p>
        ) : null}

        {src ? (
          <iframe
            ref={iframeRef}
            src={src}
            title="Scratch editor"
            allow="fullscreen; autoplay"
            className={`w-full rounded-xl border border-stone-200 bg-white dark:border-stone-800 ${fullscreen ? "min-h-0 flex-1" : "h-[34rem]"}`}
          />
        ) : (
          <div className={`w-full animate-pulse rounded-xl bg-stone-100 dark:bg-stone-900 ${fullscreen ? "flex-1" : "h-[34rem]"}`} />
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
          <span className="text-xs text-stone-500 dark:text-stone-400">{status}</span>
        </div>

        {!fullscreen ? (
          <p className="text-[11px] text-stone-400 dark:text-stone-500">
            Save and reopen your work from the <span className="font-medium text-stone-500 dark:text-stone-400">File</span> menu in the editor. {DISCLAIMER}
          </p>
        ) : null}
      </div>
    </>
  );
}
