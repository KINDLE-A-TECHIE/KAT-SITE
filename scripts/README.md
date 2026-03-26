# KAT — VPS Setup Scripts

Each service runs on its own dedicated VPS and has its own subfolder.

```
scripts/
├── jitsi-jibri/          ← Video conferencing + recording (already deployed)
│   ├── jitsi-setup.sh
│   ├── jibri-finalize.sh
│   ├── jibri-env.sh
│   └── deploy-to-vps.sh
│
└── judge0/               ← Code execution engine (separate VPS)
    ├── judge0-setup.sh
    └── deploy-to-vps.sh
```

---

## Jitsi Meet + Jibri

Scripts for Jitsi Meet (video conferencing) and Jibri (meeting recordings).
See [jitsi-jibri/](jitsi-jibri/) — already deployed.

### What the scripts do

| Script | Purpose |
|---|---|
| `jitsi-setup.sh` | Full install: Jitsi Meet + JWT auth + Jibri + Chrome + dependencies |
| `jibri-finalize.sh` | Called by Jibri after each recording — compresses, uploads to R2, notifies app |
| `jibri-env.sh` | Template for secrets loaded by the Jibri systemd service |
| `deploy-to-vps.sh` | Copies all Jitsi/Jibri scripts to the VPS in one command |

### Requirements

- Ubuntu 22.04 VPS (Hetzner CX43 or equivalent — 4+ vCPU, 8+ GB RAM)
- Domain pointing to the VPS IP (e.g. `meet.kindleatechie.com`)
- Email address for Let's Encrypt TLS
- Cloudflare R2 credentials (for recording storage)

### DNS setup

In Cloudflare DNS, add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `meet` | `YOUR_JITSI_VPS_IP` |

### Step-by-step guide

#### 1. Create a separate R2 recordings bucket

1. Cloudflare dashboard → **R2** → **Create bucket** → name it `kat-recordings`
2. Open the bucket → **Settings** → **Public access** → **Allow Access**
3. Copy the public URL (looks like `https://pub-XXXX.r2.dev`)

#### 2. Copy scripts to the VPS

```bash
chmod +x scripts/jitsi-jibri/deploy-to-vps.sh
./scripts/jitsi-jibri/deploy-to-vps.sh
# Enter: james@YOUR_JITSI_VPS_IP
```

#### 3. Run the setup script on the VPS

```bash
ssh james@YOUR_JITSI_VPS_IP
sudo bash ~/jitsi-setup.sh
```

You will be prompted for:
- **Jitsi domain** — e.g. `meet.kindleatechie.com`
- **JWT App ID** — e.g. `kat-app`
- **JWT App Secret** — leave blank to auto-generate
- **Email** — for Let's Encrypt TLS

Credentials are saved to `~/kat-jitsi-credentials.txt` on the VPS.

#### 4. Add credentials to Vercel

```
JITSI_DOMAIN=meet.kindleatechie.com
JITSI_APP_ID=kat-app
JITSI_APP_SECRET=<from script output>
JIBRI_WEBHOOK_SECRET=<from script output>
```

#### 5. Fill in jibri-env.sh and deploy it

Edit `scripts/jitsi-jibri/jibri-env.sh`:

```bash
KAT_APP_URL=https://dev.kindleatechie.com
JIBRI_WEBHOOK_SECRET=<value from step 3>
R2_ACCOUNT_ID=<your Cloudflare account ID>
R2_ACCESS_KEY_ID=<R2 API token key>
R2_SECRET_ACCESS_KEY=<R2 API token secret>
R2_RECORDINGS_BUCKET=kat-recordings
R2_RECORDINGS_PUBLIC_URL=https://pub-XXXX.r2.dev
```

Then deploy:

```bash
scp scripts/jitsi-jibri/jibri-env.sh root@YOUR_JITSI_VPS_IP:/etc/jibri-env.sh
ssh root@YOUR_JITSI_VPS_IP "chmod 600 /etc/jibri-env.sh && systemctl daemon-reload && systemctl restart jibri"
```

#### 6. Verify

```bash
ssh root@YOUR_JITSI_VPS_IP
systemctl status prosody jicofo jitsi-videobridge2 jibri
journalctl -u jibri -f
```

### What the finalize script does

After each Jibri recording finishes, `jibri-finalize.sh` runs automatically:

1. Finds the raw `.mp4` in `/srv/recordings/`
2. Re-encodes to 720p at CRF 28 with FFmpeg (reduces file size ~60%)
3. Uploads the compressed file to `kat-recordings` R2 bucket
4. Deletes local files (keeps VPS disk free)
5. POSTs a signed webhook to `/api/meetings/recording-ready` so the app saves the URL to the database

### Firewall ports

| Port | Protocol | Purpose |
|---|---|---|
| 80 | TCP | HTTP (Let's Encrypt verification) |
| 443 | TCP | HTTPS (Jitsi web) |
| 4443 | TCP | Jitsi TURN/TLS |
| 5349 | TCP | TURN over TLS (WebRTC fallback) |
| 10000 | UDP | WebRTC media (audio/video) |

### Troubleshooting

**Jibri fails to connect to XMPP:**
```bash
journalctl -u jibri -n 100
prosodyctl list --short auth.meet.kindleatechie.com
prosodyctl list --short recorder.meet.kindleatechie.com
```

**snd_aloop not loading:**
```bash
modprobe snd_aloop && lsmod | grep snd_aloop
# If it fails, reboot the VPS first
```

**Webhook returns 401:** Make sure `JIBRI_WEBHOOK_SECRET` in `/etc/jibri-env.sh` matches Vercel exactly.

---

## Judge0 CE — Code Execution Engine

Sandboxed code runner that powers KAT coding challenges. Runs on a **separate VPS** from Jitsi.
See [judge0/](judge0/).

### What the scripts do

| Script | Purpose |
|---|---|
| `judge0-setup.sh` | Full install: Docker, Judge0 CE, Nginx reverse proxy, Let's Encrypt TLS |
| `deploy-to-vps.sh` | Copies judge0-setup.sh to the VPS in one command |

### Requirements

- Ubuntu 22.04 **KVM-based** VPS (Hetzner CX43 — already what you use)
- **⚠ Does NOT work on OpenVZ / LXC** — isolate needs Linux namespaces
- 4+ vCPU, 8+ GB RAM
- A subdomain pointing to this VPS (e.g. `code.kindleatechie.com`)

### Dependencies installed by the script

| Dependency | Purpose |
|---|---|
| Docker Engine + Compose plugin | Runs all Judge0 services as containers |
| judge0/judge0:1.13.1 | Judge0 API server (Rails) |
| judge0 workers | Pulls and executes submission jobs via isolate |
| postgres:16.0 | Stores submissions and results |
| redis:7.2.1 | Job queue between server and workers |
| Nginx | Reverse proxy — exposes HTTPS, keeps port 2358 internal |
| Certbot | Let's Encrypt TLS certificate |
| UFW | Firewall (opens 22, 80, 443 only) |

### DNS setup

In Cloudflare DNS, add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `code` | `YOUR_JUDGE0_VPS_IP` |

### Step-by-step guide

#### 1. Copy the script to the VPS

```bash
chmod +x scripts/judge0/deploy-to-vps.sh
./scripts/judge0/deploy-to-vps.sh
# Enter: james@YOUR_JUDGE0_VPS_IP
```

#### 2. Run the setup script on the VPS

```bash
ssh james@YOUR_JUDGE0_VPS_IP
sudo bash ~/judge0-setup.sh
```

You will be prompted for:
- **Judge0 domain** — e.g. `code.kindleatechie.com`
- **Email** — for Let's Encrypt TLS

All passwords (Postgres, Redis, API token) are auto-generated.

#### 3. Add credentials to Vercel

```
JUDGE0_API_URL=https://code.kindleatechie.com
JUDGE0_API_KEY=<printed at end of script>
```

Credentials are also saved to `~/kat-judge0-credentials.txt` on the VPS.

#### 4. Verify the API

```bash
curl -H "X-Auth-Token: YOUR_TOKEN" https://code.kindleatechie.com/system_info
```

#### 5. Submit a test job (Python 3 = language_id 71)

```bash
curl -X POST https://code.kindleatechie.com/submissions \
  -H "X-Auth-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_code":"print(\"hello world\")","language_id":71,"stdin":""}'

# Fetch result (use token from response above)
curl -H "X-Auth-Token: YOUR_TOKEN" \
  "https://code.kindleatechie.com/submissions/TOKEN?fields=status,stdout,stderr"
```

### Management commands (on the VPS)

```bash
cd /opt/judge0
docker compose ps                            # service health
docker compose logs -f server                # API logs
docker compose logs -f workers               # worker logs
docker compose restart                       # restart all
docker compose pull && docker compose up -d  # upgrade to latest
```

### Firewall ports

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (Let's Encrypt verification) |
| 443 | TCP | HTTPS (Judge0 API) |
| 2358 | — | Loopback only — Nginx proxies this |

### Troubleshooting

**Workers not picking up jobs:**
```bash
docker compose logs workers
# Check REDIS_PASSWORD in /opt/judge0/judge0.conf
```

**Database connection error:**
```bash
docker compose logs db
docker compose logs server | grep "PG::"
# Postgres may still be initialising — wait 30s then: docker compose up -d
```

**isolate permission denied:**
VPS is OpenVZ/LXC — migrate to KVM (Hetzner Cloud is KVM).

**TLS certificate not issuing:**
```bash
dig +short code.kindleatechie.com   # must resolve to this VPS IP
certbot certificates
```
