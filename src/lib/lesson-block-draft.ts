// Local-first client for the per-user interactive-block draft store (LessonBlockDraft), talking to
// /api/curriculum/contents/[contentId]/draft. The row is always keyed to the session user server-side,
// so nothing here sends a userId.
//
// "Local-first" means every write lands in IndexedDB immediately (see offline-db.ts) and is then pushed
// to the server. A power cut, reload, or dead battery can no longer lose interactive-block work: the
// local copy is authoritative until the server confirms it. When the connection returns, dirty drafts
// (and pending deletes) are flushed. The server stays the cross-device source of truth: for a clean
// local copy, a reachable server wins; only UNSYNCED local edits are held ahead of it.

import {
  allLocalDrafts,
  deleteLocalDraft,
  readLocalDraft,
  writeLocalDraft,
  type LocalDraft,
} from "@/lib/offline-db";

// Monotonic write version so a slow PUT cannot clear `dirty` after a newer keystroke has landed.
let versionCounter = 0;
function nextVersion(): number {
  versionCounter += 1;
  return versionCounter;
}

// Let a UI (the connectivity banner) reflect how many drafts are still waiting to sync.
const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}
export function subscribeDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export async function pendingDraftCount(): Promise<number> {
  return (await allLocalDrafts()).filter((d) => d.dirty).length;
}

// When the interactive blocks run inside the school iframe embed there is no NextAuth session, so draft
// sync must go to the embed endpoints (same LessonBlockDraft row, embed-session auth). EmbedLessonBody
// turns this on once on mount. It is a module singleton, which is safe because the embed runs in its own
// browsing context (iframe/route), separate from the in-app app.
let embedMode = false;
export function setDraftEmbedMode(on: boolean): void {
  embedMode = on;
}

function draftUrl(contentId: string): string {
  return embedMode
    ? `/api/school/embed/draft/${encodeURIComponent(contentId)}`
    : `/api/curriculum/contents/${contentId}/draft`;
}

// A 4xx that will never succeed on retry (bad/oversized/absent), so stop holding it dirty forever. 401
// (auth) and 429 (rate limit) are transient and are retried; 5xx and network failures too.
function isPermanentClientError(status: number): boolean {
  return status === 400 || status === 404 || status === 413;
}

/**
 * Push one draft's current local state (or its pending delete) to the server. Clears `dirty` only if
 * the local copy has not advanced since, so a concurrent edit is never marked synced by mistake.
 * Returns false when it should be retried later (offline, auth blip, server error).
 */
async function pushOne(contentId: string): Promise<boolean> {
  const local = await readLocalDraft(contentId);
  if (!local || !local.dirty) return true;

  try {
    if (local.deleted) {
      const res = await fetch(draftUrl(contentId), { method: "DELETE" });
      if (res.ok || isPermanentClientError(res.status)) {
        await deleteLocalDraft(contentId);
        notify();
        return true;
      }
      return false;
    }

    const res = await fetch(draftUrl(contentId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: local.state }),
    });
    if (res.ok || isPermanentClientError(res.status)) {
      const cur = await readLocalDraft(contentId);
      // Only settle if this is still the version we pushed and it was not deleted meanwhile.
      if (cur && cur.v === local.v && !cur.deleted) {
        await writeLocalDraft({ ...cur, dirty: false });
        notify();
      }
      return true;
    }
    return false;
  } catch {
    return false; // offline: keep it dirty and retry on the next flush
  }
}

let flushing = false;

/** Push every dirty draft/pending-delete to the server. Returns how many settled. Safe to call often. */
export async function flushDrafts(): Promise<number> {
  if (flushing) return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    for (const d of await allLocalDrafts()) {
      if (!d.dirty) continue;
      const okSync = await pushOne(d.contentId);
      if (okSync) synced += 1;
      else break; // network dropped again; leave the rest for next time
    }
  } finally {
    flushing = false;
  }
  return synced;
}

// Distinguish "server reachable, no draft" (null) from "offline" (undefined) so we know whether to
// trust the server over a clean local copy.
async function serverGet(contentId: string): Promise<{ state: unknown } | undefined> {
  try {
    const res = await fetch(draftUrl(contentId));
    if (!res.ok) return { state: null };
    const data = (await res.json()) as { state: unknown };
    return { state: data.state ?? null };
  } catch {
    return undefined;
  }
}

/** Read this user's saved draft for a block, or null if there is none. Local-first with reconciliation. */
export async function getDraft<T = unknown>(contentId: string): Promise<T | null> {
  const local = await readLocalDraft(contentId);

  // A delete that has not reached the server yet: the draft is gone for this user. Try to finish it.
  if (local?.deleted) {
    void flushDrafts();
    return null;
  }
  // Unsynced local edits are the freshest truth. Return them and try to push in the background.
  if (local?.dirty) {
    void flushDrafts();
    return (local.state as T) ?? null;
  }

  const server = await serverGet(contentId);
  if (server === undefined) {
    // Offline: resume from the clean local copy saved during a previous online session, if any.
    return (local?.state as T) ?? null;
  }
  if (server.state != null) {
    // Online and the server has a draft: it is the cross-device source of truth for a clean local.
    await writeLocalDraft({ contentId, state: server.state, updatedAt: Date.now(), v: nextVersion(), dirty: false });
    return server.state as T;
  }
  // Server has no draft: drop any stale clean local copy so we do not resurrect a deleted draft.
  if (local) await deleteLocalDraft(contentId);
  return null;
}

/** Upsert this user's draft for a block. Stores locally at once (never lost), then syncs. Always true. */
export async function putDraft(contentId: string, state: unknown): Promise<boolean> {
  const draft: LocalDraft = { contentId, state, updatedAt: Date.now(), v: nextVersion(), dirty: true };
  await writeLocalDraft(draft);
  notify();
  void pushOne(contentId);
  return true; // stored locally, so the caller can show "saved" even while offline
}

/** Clear this user's draft for a block. Removes it locally and syncs the delete (queued if offline). */
export async function deleteDraft(contentId: string): Promise<void> {
  await writeLocalDraft({ contentId, state: null, updatedAt: Date.now(), v: nextVersion(), dirty: true, deleted: true });
  notify();
  void pushOne(contentId);
}
