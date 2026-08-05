import { randomUUID } from "crypto";

/**
 * R2 key namespace for a user's saved stage-video recordings (a .webm captured from the Scratch stage).
 * Server-side only: the routes mint keys here and verify ownership before signing a URL, so a user can only
 * ever read, write, or delete their OWN recordings.
 *
 * A recording is private (played via a presigned GET, never the public R2 URL) and the key carries no PII,
 * just opaque ids. The MIME the recorder PUTs must match what the presigned URL is signed for.
 */

export const VIDEO_PREFIX = "videos";
export const STAGE_VIDEO_CONTENT_TYPE = "video/webm";

/** Hard ceiling on a single recording. A 3-minute stage capture is well under this; it is a guard against
 *  a client sending something huge, and it must match the size the presigned PUT is signed to allow. */
export const MAX_STAGE_VIDEO_BYTES = 80 * 1024 * 1024; // 80 MB

/** A fresh key for a user's recording: videos/<userId>/<uuid>.webm. Not tied to a lesson in the key, the
 *  optional lesson/assessment association is a column on StageRecording (a "both" library + tag model). */
export function stageVideoKey(userId: string): string {
  return `${VIDEO_PREFIX}/${userId}/${randomUUID()}.webm`;
}

/**
 * True only if `key` is one of THIS user's recordings. The trailing slash in the prefix stops `.../abc/`
 * from matching a user whose id is `abcd`; the traversal guard stops `..` escaping the namespace. A route
 * must never sign or delete a key that fails this check.
 */
export function isOwnStageVideoKey(key: unknown, userId: string): key is string {
  return (
    typeof key === "string" &&
    key.startsWith(`${VIDEO_PREFIX}/${userId}/`) &&
    !key.includes("..") &&
    key.endsWith(".webm")
  );
}
