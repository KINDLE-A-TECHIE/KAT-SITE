import { MeetingRecordingStatus } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * POST /api/meetings/recording-ready
 *
 * Jibri webhook — called by the finalize script on the VPS after a recording
 * is uploaded to R2 (or another accessible location).
 *
 * Expected body:
 * {
 *   roomName:    string;   // Jitsi room name, e.g. "kat-abc123"
 *   playUrl:     string;   // Public playback URL
 *   downloadUrl: string;   // Public download URL (can be same as playUrl)
 *   jobId?:      string;   // Optional Jibri job/file identifier
 * }
 *
 * Security: HMAC-SHA256 signature in the `X-Jibri-Signature` header.
 * Compute as: HMAC-SHA256(JIBRI_WEBHOOK_SECRET, raw request body)
 * and send as hex.
 *
 * VPS finalize script example:
 *   BODY=$(cat payload.json)
 *   SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$JIBRI_WEBHOOK_SECRET" | awk '{print $2}')
 *   curl -X POST https://yourdomain.com/api/meetings/recording-ready \
 *        -H "Content-Type: application/json" \
 *        -H "X-Jibri-Signature: $SIG" \
 *        -d "$BODY"
 */
export async function POST(request: Request) {
  const secret = process.env.JIBRI_WEBHOOK_SECRET;
  if (!secret) return fail("Recording webhook is not configured.", 503);

  const rawBody = await request.text();

  // Verify HMAC signature
  const signature = request.headers.get("x-jibri-signature") ?? "";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
      return fail("Invalid signature.", 401);
    }
  } catch {
    return fail("Invalid signature.", 401);
  }

  let body: { roomName?: string; playUrl?: string; downloadUrl?: string; jobId?: string };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  if (!body.roomName || !body.playUrl) {
    return fail("roomName and playUrl are required.", 400);
  }

  const meeting = await prisma.meeting.findFirst({
    where: { roomName: body.roomName },
    select: { id: true },
  });
  if (!meeting) return fail("No meeting found for this room.", 404);

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      recordingStatus: MeetingRecordingStatus.AVAILABLE,
      recordingPlayUrl: body.playUrl,
      recordingDownloadUrl: body.downloadUrl ?? body.playUrl,
      recordingJobId: body.jobId ?? null,
      recordingSyncedAt: new Date(),
    },
  });

  return ok({ message: "Recording saved." });
}
