import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  // @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner resolve different copies of @smithy/types,
  // so the S3Client they each describe is nominally incompatible. The runtime object is the same one.
  return getSignedUrl(
    r2Client as unknown as Parameters<typeof getSignedUrl>[0],
    command,
    { expiresIn: expiresInSeconds },
  );
}

/**
 * A short-lived signed URL to READ a private object. Used for a pupil's own Scratch project (a child's
 * work, so it is never served from the public R2 URL); the editor iframe fetches this to load a project.
 */
export async function generatePresignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(
    r2Client as unknown as Parameters<typeof getSignedUrl>[0],
    command,
    { expiresIn: expiresInSeconds },
  );
}

/** Fetch an object's bytes server-side (used by the grader to read a pupil's saved .sb3 from R2). */
export async function getR2Object(key: string): Promise<Uint8Array> {
  const res = await r2Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error("Object has no body.");
  return (res.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Extract the R2 storage key from a public URL, or null if it's not an R2 URL. */
export function r2KeyFromUrl(url: string): string | null {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL + "/")) return null;
  return url.slice(R2_PUBLIC_URL.length + 1);
}
