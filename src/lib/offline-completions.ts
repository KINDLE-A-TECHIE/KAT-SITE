/**
 * A tiny, resilient queue for lesson completions made while offline.
 *
 * The setting is Nigeria's unstable power and connectivity: a pupil can finish a lesson during an
 * outage, and the completion POST would just be lost. Here we record it locally the moment the network
 * call fails, mark the lesson done in the UI right away, and replay the queue when the connection comes
 * back. The completion endpoint is an idempotent upsert, so replaying (even twice) is safe.
 *
 * Storage is localStorage, keyed per lesson, so the same lesson never queues twice and the queue
 * survives a reload or a device dying mid-session. This is a resilience layer on top of the server,
 * not a replacement: the server stays the source of truth once we reach it.
 */

const KEY = "kat:pending-completions";

type Pending = { lessonId: string; queuedAt: number };

function read(): Pending[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Pending[]).filter((p) => p && typeof p.lessonId === "string") : [];
  } catch {
    return [];
  }
}

function write(list: Pending[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable: nothing we can do, the UI has already shown it complete */
  }
}

function remove(lessonId: string): void {
  write(read().filter((p) => p.lessonId !== lessonId));
}

// Lightweight subscriptions so a badge/banner can reflect the pending count live and confirm a sync,
// no matter which caller actually drained the queue (the banner and the lesson viewer both flush).
const pendingListeners = new Set<() => void>();
const syncedListeners = new Set<(count: number) => void>();

function notify(): void {
  for (const l of pendingListeners) l();
}

function notifySynced(count: number): void {
  for (const l of syncedListeners) l(count);
}

export function subscribePending(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

/** Fires with how many completions just synced, so a UI can confirm it however the flush was triggered. */
export function subscribeSynced(listener: (count: number) => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

export function pendingCount(): number {
  return read().length;
}

/** Record a completion that could not be sent (offline). Idempotent per lesson. */
export function queueCompletion(lessonId: string): void {
  const list = read();
  if (list.some((p) => p.lessonId === lessonId)) return;
  list.push({ lessonId, queuedAt: Date.now() });
  write(list);
  notify();
}

let flushing = false;

/**
 * Try to send every queued completion. Removes a lesson on success or on a permanent client error
 * (4xx: no longer enrolled, licence lapsed, lesson gone), keeps it on a server error (5xx), and stops
 * the moment the network fails again (still offline). Returns how many synced. Safe to call often.
 */
export async function flushCompletions(): Promise<number> {
  if (typeof window === "undefined" || flushing) return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    for (const p of read()) {
      try {
        const res = await fetch(`/api/curriculum/lessons/${p.lessonId}/complete`, { method: "POST" });
        if (res.ok) {
          remove(p.lessonId);
          synced += 1;
        } else if (res.status >= 400 && res.status < 500) {
          // Permanent: this completion will never be accepted, so stop retrying it forever.
          remove(p.lessonId);
        }
        // 5xx: leave it queued and try again on the next flush.
      } catch {
        break; // network dropped again; keep the rest for next time
      }
    }
  } finally {
    flushing = false;
  }
  if (synced) {
    notify();
    notifySynced(synced);
  }
  return synced;
}
