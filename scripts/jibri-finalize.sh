#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Jibri finalize script
#
# Jibri calls this after every recording finishes.
# It receives two environment variables:
#   MEETING_URL  — full Jitsi meeting URL, e.g. https://meet.yourdomain.com/kat-abc123
#   RECORDINGS_DIR — directory containing the recording files
#
# What this script does:
#   1. Finds the recording file (mp4)
#   2. Uploads it to Cloudflare R2 using the AWS CLI (S3-compatible)
#   3. POSTs a signed webhook to /api/meetings/recording-ready
#
# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURE THESE (or export them from /etc/environment):
# ─────────────────────────────────────────────────────────────────────────────

KAT_APP_URL="${KAT_APP_URL:-https://yourdomain.com}"          # Your deployed Next.js app
JIBRI_WEBHOOK_SECRET="${JIBRI_WEBHOOK_SECRET:-changeme}"      # Must match Vercel env var

R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-}"
R2_PUBLIC_URL="${R2_PUBLIC_URL:-}"                            # e.g. https://pub-xxx.r2.dev

# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

log() { echo "[jibri-finalize] $*"; }

log "MEETING_URL=$MEETING_URL"
log "RECORDINGS_DIR=$RECORDINGS_DIR"

# ── 1. Extract room name from meeting URL ────────────────────────────────────
# URL is like https://meet.yourdomain.com/kat-abc123
ROOM_NAME=$(basename "$MEETING_URL")
log "Room name: $ROOM_NAME"

# ── 2. Find the recording file ───────────────────────────────────────────────
MP4_FILE=$(find "$RECORDINGS_DIR" -name "*.mp4" -newer /tmp/.jibri_last 2>/dev/null | head -1 || true)
if [[ -z "$MP4_FILE" ]]; then
  # Fallback: newest mp4 anywhere in the dir
  MP4_FILE=$(find "$RECORDINGS_DIR" -name "*.mp4" | sort -t_ -k1 | tail -1 || true)
fi

if [[ -z "$MP4_FILE" ]]; then
  log "ERROR: No mp4 file found in $RECORDINGS_DIR"
  exit 1
fi

FILENAME=$(basename "$MP4_FILE")
log "Recording file: $MP4_FILE"
touch /tmp/.jibri_last

# ── 3. Upload to Cloudflare R2 ───────────────────────────────────────────────
OBJECT_KEY="recordings/${ROOM_NAME}/${FILENAME}"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

log "Uploading to R2: s3://${R2_BUCKET_NAME}/${OBJECT_KEY}"

AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 cp "$MP4_FILE" "s3://${R2_BUCKET_NAME}/${OBJECT_KEY}" \
  --endpoint-url "$R2_ENDPOINT" \
  --content-type "video/mp4" \
  --no-progress

PUBLIC_URL="${R2_PUBLIC_URL}/${OBJECT_KEY}"
log "Public URL: $PUBLIC_URL"

# ── 4. Build JSON payload ────────────────────────────────────────────────────
JOB_ID="${ROOM_NAME}-$(date +%s)"
PAYLOAD=$(cat <<JSON
{
  "roomName": "${ROOM_NAME}",
  "playUrl": "${PUBLIC_URL}",
  "downloadUrl": "${PUBLIC_URL}",
  "jobId": "${JOB_ID}"
}
JSON
)

# ── 5. Sign with HMAC-SHA256 ─────────────────────────────────────────────────
SIGNATURE=$(printf '%s' "$PAYLOAD" \
  | openssl dgst -sha256 -hmac "$JIBRI_WEBHOOK_SECRET" \
  | awk '{print $2}')

log "Signature: $SIGNATURE"

# ── 6. POST to KAT webhook ───────────────────────────────────────────────────
WEBHOOK_URL="${KAT_APP_URL}/api/meetings/recording-ready"
log "Posting to: $WEBHOOK_URL"

HTTP_STATUS=$(curl -s -o /tmp/jibri_webhook_response.txt -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Jibri-Signature: $SIGNATURE" \
  -d "$PAYLOAD")

RESPONSE=$(cat /tmp/jibri_webhook_response.txt)
log "Webhook response [$HTTP_STATUS]: $RESPONSE"

if [[ "$HTTP_STATUS" != "200" ]]; then
  log "ERROR: Webhook failed with status $HTTP_STATUS"
  exit 1
fi

log "Recording successfully saved."
