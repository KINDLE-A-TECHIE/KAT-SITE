import "server-only";
import { deleteR2Object, r2KeyFromUrl } from "@/lib/r2";

const IMG_SRC = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;

// Only ever touch objects WE uploaded, under a lesson's note-images/ prefix. A body can also reference
// a school logo, a project asset, or an external image, and those must never be deleted here.
const NOTE_IMAGE_KEY = /^lessons\/[^/]+\/note-images\//;

/** The R2 keys of note images embedded in a note's HTML body (deduped). */
export function extractNoteImageKeys(html: string | null | undefined): string[] {
  if (!html) return [];
  const keys = new Set<string>();
  for (const match of html.matchAll(IMG_SRC)) {
    const key = r2KeyFromUrl(match[1]);
    if (key && NOTE_IMAGE_KEY.test(key)) keys.add(key);
  }
  return [...keys];
}

/**
 * Delete note images that were referenced in `before` but no longer are in `after` (pass `after` as
 * null when the note itself is being deleted). Best-effort: a failed delete is swallowed so it never
 * breaks the edit/delete the user asked for. This is what keeps R2 from accumulating orphans when an
 * author replaces or removes an image, or deletes a note block.
 */
export async function deleteRemovedNoteImages(
  before: string | null | undefined,
  after: string | null | undefined,
): Promise<void> {
  const kept = new Set(extractNoteImageKeys(after));
  const removed = extractNoteImageKeys(before).filter((key) => !kept.has(key));
  await Promise.all(removed.map((key) => deleteR2Object(key).catch(() => undefined)));
}
