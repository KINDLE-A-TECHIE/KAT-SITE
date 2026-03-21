#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Jibri finalize script
#
# Jibri calls this after every recording finishes.
# Receives:
#   MEETING_URL    — e.g. https://meet.yourdomain.com/kat-abc123
#   RECORDINGS_DIR — directory containing the raw recording files
#
# What this script does:
#   1. Finds the raw mp4
#   2. Compresses it with FFmpeg (720p, CRF 28) — cuts file size by ~60%
#   3. Uploads to a dedicated Cloudflare R2 recordings bucket
#   4. Deletes the local files to free VPS disk space
#   5. POSTs a signed webhook to /api/meetings/recording-ready
# ─────────────────────────────────────────────────────────────────────────────
# All values come from /etc/jibri-env.sh (loaded via systemd EnvironmentFile)
# ─────────────────────────────────────────────────────────────────────────────

KAT_APP_URL="${KAT_APP_URL:-https://yourdomain.com}"
JIBRI_WEBHOOK_SECRET="${JIBRI_WEBHOOK_SECRET:-}"

R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
# Use a SEPARATE bucket from your main app bucket to keep storage isolated
R2_RECORDINGS_BUCKET="${R2_RECORDINGS_BUCKET:-}"
R2_RECORDINGS_PUBLIC_URL="${R2_RECORDINGS_PUBLIC_URL:-}"   # e.g. https://pub-yyy.r2.dev

# How many days to keep recordings on VPS disk after upload (0 = delete immediately)
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-0}"

# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

log() { echo "[jibri-finalize] $(date '+%Y-%m-%d %H:%M:%S') $*"; }

log "MEETING_URL=$MEETING_URL"
log "RECORDINGS_DIR=$RECORDINGS_DIR"

# ── 1. Extract room name ──────────────────────────────────────────────────────
ROOM_NAME=$(basename "$MEETING_URL")
log "Room: $ROOM_NAME"

# ── 2. Find raw recording ─────────────────────────────────────────────────────
RAW_FILE=$(find "$RECORDINGS_DIR" -name "*.mp4" -newer /tmp/.jibri_last 2>/dev/null | head -1 || true)
if [[ -z "$RAW_FILE" ]]; then
  RAW_FILE=$(find "$RECORDINGS_DIR" -name "*.mp4" | sort | tail -1 || true)
fi
if [[ -z "$RAW_FILE" ]]; then
  log "ERROR: No mp4 found in $RECORDINGS_DIR"
  exit 1
fi
touch /tmp/.jibri_last

RAW_SIZE=$(du -sh "$RAW_FILE" | cut -f1)
log "Raw file: $RAW_FILE ($RAW_SIZE)"

# ── 3. Compress with FFmpeg ───────────────────────────────────────────────────
# -vf scale=-2:720   → 720p, preserving aspect ratio
# -crf 28            → quality (18=high quality/large, 32=lower quality/small)
#                      28 is a good balance for class recordings
# -preset fast       → encode speed vs compression (fast = smaller than veryfast)
# -movflags +faststart → makes the mp4 streamable before fully downloaded
COMPRESSED_FILE="${RAW_FILE%.mp4}_compressed.mp4"
log "Compressing to 720p CRF28 …"

ffmpeg -i "$RAW_FILE" \
  -vf "scale=-2:720" \
  -c:v libx264 -crf 28 -preset fast \
  -c:a aac -b:a 96k \
  -movflags +faststart \
  -y "$COMPRESSED_FILE" 2>/dev/null

COMPRESSED_SIZE=$(du -sh "$COMPRESSED_FILE" | cut -f1)
log "Compressed: $COMPRESSED_FILE ($COMPRESSED_SIZE)"

# ── 4. Upload to dedicated R2 recordings bucket ───────────────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="${ROOM_NAME}-${TIMESTAMP}.mp4"
OBJECT_KEY="recordings/${FILENAME}"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

log "Uploading to R2 bucket '${R2_RECORDINGS_BUCKET}': ${OBJECT_KEY}"

AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 cp "$COMPRESSED_FILE" "s3://${R2_RECORDINGS_BUCKET}/${OBJECT_KEY}" \
  --endpoint-url "$R2_ENDPOINT" \
  --content-type "video/mp4" \
  --no-progress

PUBLIC_URL="${R2_RECORDINGS_PUBLIC_URL}/${OBJECT_KEY}"
log "Public URL: $PUBLIC_URL"

# ── 5. Clean up local files ───────────────────────────────────────────────────
if [[ "$KEEP_LOCAL_DAYS" -eq 0 ]]; then
  log "Deleting local recording files …"
  rm -f "$RAW_FILE" "$COMPRESSED_FILE"
  # Remove the recording dir if empty
  rmdir "$RECORDINGS_DIR" 2>/dev/null || true
else
  log "Keeping local files for ${KEEP_LOCAL_DAYS} day(s). Scheduling cleanup …"
  # Schedule deletion via at (install: apt-get install -y at)
  echo "rm -rf '$RECORDINGS_DIR'" | at "now + ${KEEP_LOCAL_DAYS} days" 2>/dev/null || \
    log "WARNING: 'at' not available — delete $RECORDINGS_DIR manually after ${KEEP_LOCAL_DAYS} days."
fi

# ── 6. Sign and POST webhook ──────────────────────────────────────────────────
JOB_ID="${ROOM_NAME}-${TIMESTAMP}"
PAYLOAD=$(printf '{"roomName":"%s","playUrl":"%s","downloadUrl":"%s","jobId":"%s"}' \
  "$ROOM_NAME" "$PUBLIC_URL" "$PUBLIC_URL" "$JOB_ID")

SIGNATURE=$(printf '%s' "$PAYLOAD" \
  | openssl dgst -sha256 -hmac "$JIBRI_WEBHOOK_SECRET" \
  | awk '{print $2}')

log "Posting webhook …"
HTTP_STATUS=$(curl -s -o /tmp/jibri_webhook_resp.txt -w "%{http_code}" \
  -X POST "${KAT_APP_URL}/api/meetings/recording-ready" \
  -H "Content-Type: application/json" \
  -H "X-Jibri-Signature: $SIGNATURE" \
  -d "$PAYLOAD")

log "Webhook [$HTTP_STATUS]: $(cat /tmp/jibri_webhook_resp.txt)"

if [[ "$HTTP_STATUS" != "200" ]]; then
  log "ERROR: Webhook failed"
  exit 1
fi

log "Done."
