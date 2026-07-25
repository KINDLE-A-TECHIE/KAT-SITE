// Client helpers for the per-user interactive-block draft store (LessonBlockDraft), talking to
// /api/curriculum/contents/[contentId]/draft. The row is always keyed to the session user server-side,
// so nothing here sends a userId. All three are best-effort: a network blip must never break the block,
// it just means this keystroke was not persisted (the next debounced save retries).

/** Read this user's saved draft for a block, or null if there is none. */
export async function getDraft<T = unknown>(contentId: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/curriculum/contents/${contentId}/draft`);
    if (!res.ok) return null;
    const data = (await res.json()) as { state: T | null };
    return data.state ?? null;
  } catch {
    return null;
  }
}

/** Upsert this user's draft for a block. Returns whether it was saved. */
export async function putDraft(contentId: string, state: unknown): Promise<boolean> {
  try {
    const res = await fetch(`/api/curriculum/contents/${contentId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Clear this user's draft for a block (idempotent server-side). */
export async function deleteDraft(contentId: string): Promise<void> {
  try {
    await fetch(`/api/curriculum/contents/${contentId}/draft`, { method: "DELETE" });
  } catch {
    /* best-effort */
  }
}
