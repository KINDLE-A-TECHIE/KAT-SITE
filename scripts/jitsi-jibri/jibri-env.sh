#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Jibri environment variables
#
# Steps:
# 1. Fill in ALL values below
# 2. Copy to VPS:
#      scp scripts/jibri-env.sh root@YOUR_VPS_IP:/etc/jibri-env.sh
#      ssh root@YOUR_VPS_IP "chmod 600 /etc/jibri-env.sh"
# 3. Reload Jibri:
#      systemctl daemon-reload && systemctl restart jibri
#
# The JIBRI_WEBHOOK_SECRET was printed at the end of jitsi-setup.sh.
# Copy it from /root/kat-jitsi-credentials.txt on the VPS.
# ─────────────────────────────────────────────────────────────────────────────

# Your deployed KAT Next.js app URL (no trailing slash)
KAT_APP_URL=https://dev.kindleatechie.com

# Must match JIBRI_WEBHOOK_SECRET on Vercel (printed by jitsi-setup.sh)
JIBRI_WEBHOOK_SECRET=ab93c78e260d5f8f00e6369b341cd7cd637528b04ff427f6a70d6892969dc484

# ── Cloudflare R2 credentials ─────────────────────────────────────────────────
# Use the SAME account credentials as your main app R2 bucket
R2_ACCOUNT_ID=06ed00d74bad41946cea4fac6b7ee67c
R2_ACCESS_KEY_ID=6cb6f1d27e1882945ff13a52642a66c6
R2_SECRET_ACCESS_KEY=e362681bda85da3ddd560f9be41c7b66339d0b5baed66262713fc1afc00440fa

# ── Recordings bucket ─────────────────────────────────────────────────────────
# Create a SEPARATE bucket from your main app bucket:
#   Cloudflare dashboard → R2 → Create bucket → name it "kat-recordings"
#   Then: Settings → Public access → Allow Access → copy the public URL
R2_RECORDINGS_BUCKET=kat-recordings
R2_RECORDINGS_PUBLIC_URL=https://pub-0ca65fcd363b47daa950e47dfecac4f4.r2.dev

# How many days to keep raw files on VPS disk after uploading to R2
# 0 = delete immediately (recommended — the CX43 has 160 GB but recordings are large)
KEEP_LOCAL_DAYS=0
