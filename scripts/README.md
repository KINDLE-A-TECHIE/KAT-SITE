# KAT. Scripts

Two kinds of scripts live here: VPS setup scripts (each self-hosted service runs on its own
dedicated VPS and has its own subfolder) and one-off Node maintenance scripts you run by hand
against the deployed app. See [Node maintenance scripts](#node-maintenance-scripts) at the bottom
for the latter.

```
scripts/
├── jitsi-jibri/               ← Video conferencing + recording (already deployed)
│   ├── jitsi-setup.sh
│   ├── jibri-finalize.sh
│   ├── jibri-env.sh
│   └── deploy-to-vps.sh
│
├── judge0/                    ← Code execution engine (separate VPS)
│   ├── judge0-setup.sh
│   └── deploy-to-vps.sh
│
├── scratch-editor/            ← Self-hosted Scratch editor fork (recipe + postMessage bridge)
│
├── qstash-webhook-drain.mjs   ← Schedules frequent draining of the school webhook outbox
└── mirror-pyodide-to-r2.mjs   ← Mirrors the Pyodide runtime core onto R2
```

---

## Jitsi Meet + Jibri

Scripts for Jitsi Meet (video conferencing) and Jibri (meeting recordings).
See [jitsi-jibri/](jitsi-jibri/), already deployed.

### What the scripts do

| Script | Purpose |
|---|---|
| `jitsi-setup.sh` | Full install: Jitsi Meet + JWT auth + Jibri + Chrome + dependencies |
| `jibri-finalize.sh` | Called by Jibri after each recording, compresses, uploads to R2, notifies app |
| `jibri-env.sh` | Template for secrets loaded by the Jibri systemd service |
| `deploy-to-vps.sh` | Copies all Jitsi/Jibri scripts to the VPS in one command |

### Requirements

- Ubuntu 22.04 VPS (Hetzner CX43 or equivalent, 4+ vCPU, 8+ GB RAM)
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
- **Jitsi domain**, e.g. `meet.kindleatechie.com`
- **JWT App ID**, e.g. `kat-app`
- **JWT App Secret**, leave blank to auto-generate
- **Email**, for Let's Encrypt TLS

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

## Judge0 CE. Code Execution Engine

Sandboxed code runner that powers KAT coding challenges. Runs on a **separate VPS** from Jitsi.
See [judge0/](judge0/).

### What the scripts do

| Script | Purpose |
|---|---|
| `judge0-setup.sh` | Full install: Docker, Judge0 CE, Nginx reverse proxy, Let's Encrypt TLS |
| `deploy-to-vps.sh` | Copies judge0-setup.sh to the VPS in one command |

### Requirements

- Ubuntu 22.04 **KVM-based** VPS (Hetzner CX43, already what you use)
- **⚠ Does NOT work on OpenVZ / LXC**, isolate needs Linux namespaces
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
| Nginx | Reverse proxy, exposes HTTPS, keeps port 2358 internal |
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
- **Judge0 domain**, e.g. `code.kindleatechie.com`
- **Email**, for Let's Encrypt TLS

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
| 2358 |, | Loopback only. Nginx proxies this |

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
# Postgres may still be initialising, wait 30s then: docker compose up -d
```

**isolate permission denied:**
VPS is OpenVZ/LXC, migrate to KVM (Hetzner Cloud is KVM).

**TLS certificate not issuing:**
```bash
dig +short code.kindleatechie.com   # must resolve to this VPS IP
certbot certificates
```

---

## Node maintenance scripts

Scripts you run by hand, not part of any VPS. They target the **deployed** app and your live
Upstash / R2 / database, so run them deliberately with real production values, never dev ones.

### `bootstrap-prod.ts`. Populate a fresh production database

The **first** thing to run on a new prod database, right after `npx prisma migrate deploy`. Unlike the
dev seed (`prisma/seed.ts`), it creates **no demo accounts and no fake data**. It is idempotent, safe
to re-run, and does exactly three things:

1. Upserts the default Organisation (from `DEFAULT_ORGANIZATION_*`, the same record the app auto-creates
   at runtime).
2. Creates (or promotes) **one super-admin** from `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD`. This breaks
   the chicken-and-egg: public signup only makes parents/students, and invites/promote both need an
   existing super-admin. The password is set only when the account is **created**; on an existing account
   it promotes the role and leaves the password alone (pass `--reset-password` to change it).
3. With `--nerdc`, seeds the NERDC school curriculum (real KAT-authored courses/terms/lessons, no demo
   schools or pupils). Omit it if you are not running the B2B school product.

Runs via `tsx` (a dev dependency) so it can reuse the app's NERDC seeder. Set the same
`DATABASE_URL` / `DIRECT_URL` the app uses:

```bash
SUPERADMIN_EMAIL=you@kindleatechie.com \
SUPERADMIN_PASSWORD='a-long-strong-secret' \
  npx tsx scripts/bootstrap-prod.ts --nerdc
```

Locally you can load an env file instead of prefixing:
`npx tsx --env-file=.env.local scripts/bootstrap-prod.ts`. Requirements: `SUPERADMIN_PASSWORD` must be at
least 12 characters (and it refuses the dev seed password). After it runs, sign in as that super-admin and
build everything else from the dashboard: invite admins, author real programmes, provision schools.

**Do NOT run `npm run prisma:seed` on production.** That is the dev seed, and it creates six demo accounts
(including a super-admin) all with the password `Passw0rd!`, plus fake programmes, payments, and meetings.

### `qstash-webhook-drain.mjs`. Drain the school webhook outbox on time

When something happens in a school (a pupil finishes a lesson, say), the app queues a "tell the
school's system" message in a webhook outbox. A cron endpoint, `GET /api/cron/webhook-drain`
(guarded by `CRON_SECRET`), actually sends those. This script registers an **Upstash QStash**
schedule that calls that endpoint every few minutes so the outbox drains promptly.

**When you need it:** only when the deployment's own cron is too infrequent. Vercel **Hobby** caps
native crons at once per day, which would delay every school webhook by up to 24 hours. On a plan
with sub-daily crons, use the platform cron and skip this script.

It is **idempotent**: each run deletes any existing schedule pointing at the endpoint, then creates a
fresh one, so re-running never stacks duplicates.

**What you need:**

| Value | Where to get it |
|---|---|
| `QSTASH_TOKEN` | Upstash console → **QStash** → "REST Token" (not the Redis token) |
| `CRON_SECRET` | The exact value the deployed app uses (Vercel → Project → Settings → Environment Variables). QStash forwards it as `Authorization`, which the route checks. |
| `APP_URL` | The deployed **apex** URL, same as `NEXTAUTH_URL` (e.g. `https://kindleatechie.com`). Must be public https. QStash cannot reach `localhost`. Falls back to `NEXTAUTH_URL` if unset. |

Use the apex domain, **not** the `schools.` subdomain: it is one deployment with one shared outbox,
and the drain route is not tenant-scoped, so the hostname makes no difference.

**Run once, against the deployed app.** PowerShell:

```powershell
$env:QSTASH_TOKEN = "<upstash-qstash-rest-token>"
$env:CRON_SECRET  = "<deployed CRON_SECRET>"
$env:APP_URL      = "https://kindleatechie.com"
node scripts/qstash-webhook-drain.mjs
```

Or bash:

```bash
QSTASH_TOKEN=<token> CRON_SECRET=<secret> APP_URL=https://kindleatechie.com node scripts/qstash-webhook-drain.mjs
```

Override the cadence with `DRAIN_CRON` (default `*/5 * * * *`, every 5 minutes). On success it prints
the scheduled destination and the `scheduleId`. View, edit, or delete the schedule in the Upstash
console → **QStash** → **Schedules**; delete it there to turn draining off.

### `mirror-pyodide-to-r2.mjs`. Self-host the Pyodide runtime core

Copies the Pyodide core (~13 MB: `pyodide.js`, `pyodide.asm.js`, `pyodide.asm.wasm`,
`python_stdlib.zip`, `pyodide-lock.json`) onto your R2 bucket so the in-browser Python playground
loads its runtime from your own domain instead of a third-party CDN. On-demand packages (numpy, etc.)
stay on the CDN: the lockfile's package URLs are rewritten to absolute CDN URLs so `import numpy`
still resolves without mirroring hundreds of MB of wheels.

Reads R2 credentials from `.env.local`, so run it with `--env-file`:

```bash
node --env-file=.env.local scripts/mirror-pyodide-to-r2.mjs
```

It uploads to `pyodide/v<VERSION>/` (VERSION is pinned near the top of the script, currently
`0.26.4`). When it finishes, point the app at the mirror:

```
NEXT_PUBLIC_PYODIDE_INDEX_URL=<R2_PUBLIC_URL>/pyodide/v0.26.4/
```

When upgrading Pyodide, bump `VERSION` in the script, re-run it, then update the pinned version in
`src/components/dashboard/code-playground-block.tsx` and `NEXT_PUBLIC_PYODIDE_INDEX_URL` together.
