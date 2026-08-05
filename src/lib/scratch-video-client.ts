/**
 * Browser-side helpers the Scratch surfaces use to save a stage recording: mint a presigned upload URL
 * (rate-limited server-side) and, after the recorder PUTs the .webm to R2, confirm it so the DB row is
 * created. Shared by the lesson ScratchBlock and the assessment ScratchAnswer so the flow lives in one place.
 */

/** Ask the server for a presigned PUT URL for a recording of `sizeBytes`. Returns a friendly error on a
 *  rate-limit (429), a too-large payload, or a network failure, so the caller can tell the editor why. */
export async function mintVideoUploadUrl(
  sizeBytes: number,
): Promise<{ uploadUrl: string; key: string } | { error: string }> {
  try {
    const res = await fetch("/api/videos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sizeBytes }),
    });
    if (res.status === 429) return { error: "You have saved a lot of recordings recently. Please try again later." };
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { error: data.error || "Could not start the upload." };
    }
    return (await res.json()) as { uploadUrl: string; key: string };
  } catch {
    return { error: "Could not reach the server. Check your connection." };
  }
}

/** Confirm a completed upload so its StageRecording row is created. `contentId` tags where it was made. */
export async function confirmVideoSaved(input: {
  key: string;
  contentId: string | null;
  sizeBytes: number;
  durationMs: number | null;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}
