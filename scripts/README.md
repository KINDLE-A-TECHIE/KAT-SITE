# KAT — VPS Setup Scripts

Scripts for installing Jitsi Meet (video conferencing) and Jibri (meeting recordings) on a self-hosted Ubuntu 22.04 VPS.

## What these scripts do

| Script | Purpose |
|---|---|
| `jitsi-setup.sh` | Full install: Jitsi Meet + JWT auth + Jibri + Chrome + dependencies |
| `jibri-finalize.sh` | Called by Jibri after each recording — compresses, uploads to R2, notifies app |
| `jibri-env.sh` | Template for secrets loaded by the Jibri systemd service |
| `deploy-to-vps.sh` | Helper to copy all scripts to the VPS in one command |

---

## Requirements

- Ubuntu 22.04 VPS (Hetzner CX43 or equivalent — 4+ vCPU, 8+ GB RAM)
- A domain or subdomain pointing to the VPS IP (e.g. `meet.kindleatechie.com`)
- A valid email address for the Let's Encrypt TLS certificate
- Cloudflare R2 credentials (for recording storage)

### DNS setup (before running the script)

In your Cloudflare DNS dashboard, add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `meet` | `YOUR_VPS_IP` |

This creates `meet.kindleatechie.com`. Wait a minute for DNS to propagate before running the script.

---

## Step-by-step guide

### 1. Create a separate R2 recordings bucket

Before setting up the VPS, create a dedicated bucket for recordings:

1. Cloudflare dashboard → **R2** → **Create bucket** → name it `kat-recordings`
2. Open the bucket → **Settings** → **Public access** → **Allow Access**
3. Copy the public URL (looks like `https://pub-XXXX.r2.dev`)

> Keep recordings separate from your main app bucket so you can manage lifecycle rules independently. Set a lifecycle rule to delete recordings after 30–90 days if storage costs are a concern.

### 2. Copy scripts to the VPS

From your local machine (inside the `app/` directory):

```bash
chmod +x scripts/deploy-to-vps.sh
./scripts/deploy-to-vps.sh
# Enter: root@YOUR_VPS_IP
```

### 3. Run the setup script on the VPS

SSH into the VPS and run:

```bash
ssh root@YOUR_VPS_IP
sudo bash /root/jitsi-setup.sh
```

You will be prompted for:
- **Jitsi domain** — e.g. `meet.kindleatechie.com`
- **JWT App ID** — e.g. `kat-app` (can be anything, used as the JWT `iss` field)
- **JWT App Secret** — leave blank to auto-generate
- **Email** — for Let's Encrypt TLS

The script takes 5–10 minutes. At the end it prints credentials like:

```
JITSI_DOMAIN=meet.kindleatechie.com
JITSI_APP_ID=kat-app
JITSI_APP_SECRET=a3f9...
JIBRI_WEBHOOK_SECRET=7c2d...
```

These are also saved to `/root/kat-jitsi-credentials.txt` on the VPS.

### 4. Add the credentials to Vercel

In Vercel → your project → **Settings** → **Environment Variables**, add:

```
JITSI_DOMAIN=meet.kindleatechie.com
JITSI_APP_ID=kat-app
JITSI_APP_SECRET=<from step 3>
JIBRI_WEBHOOK_SECRET=<from step 3>
```

Then **redeploy** the app on Vercel for the variables to take effect.

### 5. Fill in jibri-env.sh and deploy it

Edit `scripts/jibri-env.sh` on your local machine:

```bash
KAT_APP_URL=https://dev.kindleatechie.com
JIBRI_WEBHOOK_SECRET=<value from step 3>
R2_ACCOUNT_ID=<your Cloudflare account ID>
R2_ACCESS_KEY_ID=<R2 API token key>
R2_SECRET_ACCESS_KEY=<R2 API token secret>
R2_RECORDINGS_BUCKET=kat-recordings
R2_RECORDINGS_PUBLIC_URL=https://pub-XXXX.r2.dev
```

Then copy it to the VPS:

```bash
scp scripts/jibri-env.sh root@YOUR_VPS_IP:/etc/jibri-env.sh
ssh root@YOUR_VPS_IP "chmod 600 /etc/jibri-env.sh && systemctl daemon-reload && systemctl restart jibri"
```

### 6. Verify everything works

```bash
ssh root@YOUR_VPS_IP

# Check all services are running
systemctl status prosody
systemctl status jicofo
systemctl status jitsi-videobridge2
systemctl status jibri

# Watch Jibri logs live
journalctl -u jibri -f
```

Then open `https://meet.kindleatechie.com` in a browser. If JWT is configured correctly, joining without a token will be blocked.

To test from the app: schedule a meeting in the KAT dashboard and click **Join**.

---

## What the finalize script does

After each Jibri recording finishes, `jibri-finalize.sh` runs automatically:

1. Finds the raw `.mp4` in `/srv/recordings/`
2. Re-encodes to 720p at CRF 28 with FFmpeg (reduces file size ~60%)
3. Uploads the compressed file to `kat-recordings` R2 bucket
4. Deletes local files (keeps VPS disk free)
5. POSTs a signed webhook to `/api/meetings/recording-ready` so the app saves the recording URL to the database

The webhook is HMAC-SHA256 signed using `JIBRI_WEBHOOK_SECRET`. The app verifies the signature before saving anything.

---

## Troubleshooting

**Jibri fails to connect to XMPP:**
```bash
journalctl -u jibri -n 100
# Look for "Could not connect" — usually means wrong domain or password in jibri.conf
# Verify Prosody accounts exist:
prosodyctl list --short auth.meet.kindleatechie.com
prosodyctl list --short recorder.meet.kindleatechie.com
```

**snd_aloop not loading:**
```bash
modprobe snd_aloop
lsmod | grep snd_aloop
# If it fails, reboot the VPS first — the module needs the kernel to be current
reboot
```

**Chrome crashes in Jibri:**
```bash
google-chrome --version   # should be latest stable
# If outdated:
apt-get update && apt-get install -y google-chrome-stable
```

**Let's Encrypt certificate renewal:**
Certbot is installed by the Jitsi setup and auto-renews via a systemd timer. Check with:
```bash
certbot certificates
systemctl status certbot.timer
```

**Webhook returns 401 (invalid signature):**
Make sure `JIBRI_WEBHOOK_SECRET` in `/etc/jibri-env.sh` on the VPS matches `JIBRI_WEBHOOK_SECRET` in Vercel exactly (no extra spaces or newlines).

---

## Firewall ports opened by the script

| Port | Protocol | Purpose |
|---|---|---|
| 80 | TCP | HTTP (Let's Encrypt verification) |
| 443 | TCP | HTTPS (Jitsi web) |
| 4443 | TCP | Jitsi TURN/TLS |
| 5349 | TCP | TURN over TLS (WebRTC fallback) |
| 10000 | UDP | WebRTC media (audio/video) |
