import { randomUUID } from "crypto";

/**
 * R2 key namespace for pupils' saved Scratch projects (.sb3). Server-side only: the routes mint keys here
 * and verify ownership before signing a URL, so a pupil can only ever read or overwrite their OWN project.
 *
 * A child's work is private (loaded via a presigned GET, never the public R2 URL) and the key carries no
 * PII, just opaque ids. The MIME the bridge PUTs must match what the presigned URL is signed for.
 */

export const SCRATCH_KEY_PREFIX = "scratch-projects";
export const SCRATCH_SB3_CONTENT_TYPE = "application/x.scratch.sb3";

/** A fresh key for a save: scratch-projects/<userId>/<contentId>/<uuid>.sb3. */
export function scratchProjectKey(userId: string, contentId: string): string {
  return `${SCRATCH_KEY_PREFIX}/${userId}/${contentId}/${randomUUID()}.sb3`;
}

/**
 * True only if `key` is one of THIS user's Scratch projects. The trailing slash in the prefix stops
 * `.../abc/` from matching a user whose id is `abcd`, and the traversal guard stops `..` escaping the
 * namespace. A download route must never sign a key that fails this check.
 */
export function isOwnScratchKey(key: unknown, userId: string): key is string {
  return (
    typeof key === "string" &&
    key.startsWith(`${SCRATCH_KEY_PREFIX}/${userId}/`) &&
    !key.includes("..") &&
    key.endsWith(".sb3")
  );
}
