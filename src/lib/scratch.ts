/**
 * Scratch / TurboWarp integration contract (Phase 3a).
 *
 * KAT never iframes a public Scratch site. It embeds a SELF-HOSTED scratch-gui (vanilla, which embeds
 * without patching, unlike TurboWarp) on a KAT-controlled origin (see scripts/scratch-editor/). This
 * module is the shared contract between the two halves: the KAT page (parent) and that editor iframe
 * (child) talk over `postMessage`, and the same message names + shapes live here so both sides agree. The
 * editor-side copy lives in scripts/scratch-editor/bridge.js and MUST match these strings.
 *
 * Enabled only when NEXT_PUBLIC_SCRATCH_EDITOR_URL is set (absent = Scratch off, the same
 * feature-flag-by-env pattern as NEXT_PUBLIC_PYODIDE_INDEX_URL / EMBED_TOKEN_SECRET). Nothing here reaches
 * the network or the DOM, so it is unit-testable in isolation.
 */

/** postMessage `type` values. Namespaced so a stray message from another frame is never mistaken for ours. */
export const SCRATCH_MSG = {
  // editor -> parent
  READY: "kat:scratch:ready",
  DIRTY: "kat:scratch:dirty",
  SAVED: "kat:scratch:saved",
  SAVE_FAILED: "kat:scratch:save-failed",
  // editor -> parent: the pupil chose File -> Save / Open, so the editor asks the parent for a fresh
  // presigned URL. The parent replies with SAVE / LOAD below. No payload: the parent knows the content
  // block and the session user, and mints URLs scoped to them.
  REQUEST_SAVE: "kat:scratch:request-save",
  REQUEST_LOAD: "kat:scratch:request-load",
  // editor -> parent: the pupil recorded a stage video and chose "Save to my account". The editor asks
  // for a presigned upload URL (carrying the byte size so the parent can enforce the size cap + rate
  // limit), PUTs the .webm to R2 itself, then reports VIDEO_SAVED{key} (or VIDEO_SAVE_FAILED).
  REQUEST_VIDEO_UPLOAD: "kat:scratch:request-video-upload",
  VIDEO_SAVED: "kat:scratch:video-saved",
  VIDEO_SAVE_FAILED: "kat:scratch:video-save-failed",
  // parent -> editor
  LOAD: "kat:scratch:load",
  SAVE: "kat:scratch:save",
  // parent -> editor: the reply to REQUEST_VIDEO_UPLOAD. VIDEO_UPLOAD_URL hands over a presigned PUT;
  // VIDEO_UPLOAD_DENIED carries a reason (rate limited, too large, disabled) to show the pupil.
  VIDEO_UPLOAD_URL: "kat:scratch:video-upload-url",
  VIDEO_UPLOAD_DENIED: "kat:scratch:video-upload-denied",
} as const;

/** Messages the editor sends UP to the KAT page. */
export type ScratchInbound =
  | { type: typeof SCRATCH_MSG.READY }
  | { type: typeof SCRATCH_MSG.DIRTY }
  | { type: typeof SCRATCH_MSG.SAVED; key: string }
  | { type: typeof SCRATCH_MSG.SAVE_FAILED; message: string }
  | { type: typeof SCRATCH_MSG.REQUEST_SAVE }
  | { type: typeof SCRATCH_MSG.REQUEST_LOAD }
  | { type: typeof SCRATCH_MSG.REQUEST_VIDEO_UPLOAD; sizeBytes: number; durationMs: number | null }
  | { type: typeof SCRATCH_MSG.VIDEO_SAVED; key: string; sizeBytes: number; durationMs: number | null }
  | { type: typeof SCRATCH_MSG.VIDEO_SAVE_FAILED; message: string };

/** Messages the KAT page sends DOWN to the editor. */
export type ScratchOutbound =
  | { type: typeof SCRATCH_MSG.LOAD; projectUrl: string | null }
  | { type: typeof SCRATCH_MSG.SAVE; uploadUrl: string; key: string }
  | { type: typeof SCRATCH_MSG.VIDEO_UPLOAD_URL; uploadUrl: string; key: string }
  | { type: typeof SCRATCH_MSG.VIDEO_UPLOAD_DENIED; message: string };

/** The configured self-hosted editor URL, or null when Scratch is not enabled for this deployment. */
export function getScratchEditorUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SCRATCH_EDITOR_URL;
  return url && url.trim() ? url.trim().replace(/\/$/, "") : null;
}

export function isScratchEnabled(): boolean {
  return getScratchEditorUrl() !== null;
}

/**
 * The origin of the editor URL, for both the postMessage `targetOrigin` and validating inbound messages.
 * Returns null when unset or malformed (so a bad env value fails closed, never "*").
 */
export function scratchEditorOrigin(): string | null {
  const url = getScratchEditorUrl();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * True only if `event` came from the expected editor origin AND carries an object payload. The caller
 * still parses the payload with parseScratchInbound. Never trust a message whose origin we cannot pin,
 * a wrong or absent expectedOrigin fails closed.
 */
export function isTrustedScratchMessage(
  event: { origin: string; data: unknown },
  expectedOrigin: string | null,
): boolean {
  if (!expectedOrigin) return false;
  if (event.origin !== expectedOrigin) return false;
  return typeof event.data === "object" && event.data !== null;
}

/** Validate + narrow a raw inbound payload to a known editor message, or null if it is not one of ours. */
export function parseScratchInbound(data: unknown): ScratchInbound | null {
  if (typeof data !== "object" || data === null) return null;
  const type = (data as { type?: unknown }).type;
  switch (type) {
    case SCRATCH_MSG.READY:
      return { type: SCRATCH_MSG.READY };
    case SCRATCH_MSG.DIRTY:
      return { type: SCRATCH_MSG.DIRTY };
    case SCRATCH_MSG.SAVED: {
      const key = (data as { key?: unknown }).key;
      return typeof key === "string" && key.length > 0 ? { type: SCRATCH_MSG.SAVED, key } : null;
    }
    case SCRATCH_MSG.SAVE_FAILED: {
      const message = (data as { message?: unknown }).message;
      return { type: SCRATCH_MSG.SAVE_FAILED, message: typeof message === "string" ? message : "Save failed." };
    }
    case SCRATCH_MSG.REQUEST_SAVE:
      return { type: SCRATCH_MSG.REQUEST_SAVE };
    case SCRATCH_MSG.REQUEST_LOAD:
      return { type: SCRATCH_MSG.REQUEST_LOAD };
    case SCRATCH_MSG.REQUEST_VIDEO_UPLOAD: {
      const sizeBytes = (data as { sizeBytes?: unknown }).sizeBytes;
      if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return null;
      return { type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD, sizeBytes, durationMs: readDurationMs(data) };
    }
    case SCRATCH_MSG.VIDEO_SAVED: {
      const key = (data as { key?: unknown }).key;
      const sizeBytes = (data as { sizeBytes?: unknown }).sizeBytes;
      if (typeof key !== "string" || key.length === 0) return null;
      if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return null;
      return { type: SCRATCH_MSG.VIDEO_SAVED, key, sizeBytes, durationMs: readDurationMs(data) };
    }
    case SCRATCH_MSG.VIDEO_SAVE_FAILED: {
      const message = (data as { message?: unknown }).message;
      return { type: SCRATCH_MSG.VIDEO_SAVE_FAILED, message: typeof message === "string" ? message : "Recording save failed." };
    }
    default:
      return null;
  }
}

/** A finite positive duration in ms, or null when absent/invalid (duration is a nicety, never required). */
function readDurationMs(data: unknown): number | null {
  const d = (data as { durationMs?: unknown }).durationMs;
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null;
}

/** Build the LOAD command: open `projectUrl` (a fetchable .sb3) or a blank project when null. */
export function loadMessage(projectUrl: string | null): ScratchOutbound {
  return { type: SCRATCH_MSG.LOAD, projectUrl: projectUrl ?? null };
}

/** Build the SAVE command: serialize the project and PUT it to `uploadUrl`; on success reply SAVED{key}. */
export function saveMessage(uploadUrl: string, key: string): ScratchOutbound {
  return { type: SCRATCH_MSG.SAVE, uploadUrl, key };
}

/** Build the reply to REQUEST_VIDEO_UPLOAD: PUT the recording to `uploadUrl`, then reply VIDEO_SAVED{key}. */
export function videoUploadUrlMessage(uploadUrl: string, key: string): ScratchOutbound {
  return { type: SCRATCH_MSG.VIDEO_UPLOAD_URL, uploadUrl, key };
}

/** Build the denial of a video upload (rate limited, too large, or disabled), with a reason to show. */
export function videoUploadDeniedMessage(message: string): ScratchOutbound {
  return { type: SCRATCH_MSG.VIDEO_UPLOAD_DENIED, message };
}
