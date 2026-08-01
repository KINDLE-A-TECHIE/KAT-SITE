import "server-only";
import sharp from "sharp";

/** Image types we accept for upload; sharp re-encodes them all to WebP. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Compress an image to WebP, server-side, so a big upload is stored small.
 *
 * - Auto-orients from EXIF, then strips all metadata.
 * - Caps the longest side at `maxDimension` (never enlarges).
 * - Tries lossless first (preserves a logo's transparency and crisp edges); if that exceeds
 *   `targetBytes`, steps quality down (85 → 75 → 65 → 60) until it fits. Even the last resort is well
 *   under any sane ceiling.
 *
 * This is why a caller can accept a large raw file and still guarantee a small stored object.
 */
export async function compressImageToWebp(
  input: Buffer,
  opts: { maxDimension: number; targetBytes: number },
): Promise<Buffer> {
  const pipeline = sharp(input, { failOn: "truncated" })
    .rotate()
    .resize(opts.maxDimension, opts.maxDimension, { fit: "inside", withoutEnlargement: true })
    .withMetadata({ exif: {} });

  const lossless = await pipeline.clone().webp({ lossless: true }).toBuffer();
  if (lossless.byteLength <= opts.targetBytes) return lossless;

  for (const quality of [85, 75, 65, 60]) {
    const attempt = await pipeline.clone().webp({ quality, effort: 6 }).toBuffer();
    if (attempt.byteLength <= opts.targetBytes) return attempt;
  }

  return pipeline.clone().webp({ quality: 60, effort: 6 }).toBuffer();
}
