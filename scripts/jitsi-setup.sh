#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Jitsi Meet + Jibri setup script
#
# Run on a fresh Ubuntu 22.04 VPS as root (or with sudo).
#
# Usage:
#   chmod +x jitsi-setup.sh
#   sudo ./jitsi-setup.sh
#
# You will be prompted for:
#   DOMAIN         — your Jitsi domain,   e.g. meet.yourdomain.com
#   APP_ID         — JWT app ID,          e.g. kat-app
#   APP_SECRET     — JWT app secret       (leave blank to auto-generate)
#   EMAIL          — for Let's Encrypt TLS certificate
#
# After the script completes it prints the values you need to add to Vercel.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}►${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
die()  { echo -e "${RED}✖${NC}  $*"; exit 1; }

[[ "$EUID" -ne 0 ]] && die "Please run as root: sudo ./jitsi-setup.sh"

# ── 0. Gather config ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  KAT — Jitsi Meet + Jibri installer"
echo "═══════════════════════════════════════════════════════════"
echo ""

read -rp "Jitsi domain (e.g. meet.yourdomain.com): " DOMAIN
[[ -z "$DOMAIN" ]] && die "DOMAIN is required."

read -rp "JWT App ID   (e.g. kat-app):             " APP_ID
[[ -z "$APP_ID" ]] && die "APP_ID is required."

read -rp "JWT App Secret (blank = auto-generate):  " APP_SECRET
if [[ -z "$APP_SECRET" ]]; then
  APP_SECRET=$(openssl rand -hex 32)
  warn "Generated APP_SECRET: $APP_SECRET"
  warn "Save this — you need it in JITSI_APP_SECRET on Vercel."
fi

read -rp "Email for Let's Encrypt TLS:             " EMAIL
[[ -z "$EMAIL" ]] && die "EMAIL is required."

# Generate Jibri XMPP passwords now so we can use them in BOTH
# Prosody registration AND jibri.conf (they must match)
JIBRI_AUTH_PASS=$(openssl rand -hex 16)
RECORDER_PASS=$(openssl rand -hex 16)
JIBRI_WEBHOOK_SECRET=$(openssl rand -hex 32)

echo ""
log "Starting installation on $DOMAIN …"
echo ""

# ── 1. System prep ────────────────────────────────────────────────────────────
log "Updating system packages …"
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget gnupg2 apt-transport-https ca-certificates \
  python3 openssl at software-properties-common \
  ffmpeg unzip lsof net-tools

# ── 2. Java 17 (required by Jitsi + Jibri) ───────────────────────────────────
log "Installing OpenJDK 17 …"
apt-get install -y openjdk-17-jdk
java -version

# ── 3. Add Prosody repo (must be added BEFORE Jitsi repo) ────────────────────
log "Adding Prosody apt repository …"
curl -sL https://prosody.im/files/prosody-debian-packages.key \
  | gpg --dearmor -o /usr/share/keyrings/prosody-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/prosody-keyring.gpg] \
  http://packages.prosody.im/debian $(lsb_release -sc) main" \
  > /etc/apt/sources.list.d/prosody.list
apt-get update -y

# ── 4. Add Jitsi apt repo ─────────────────────────────────────────────────────
log "Adding Jitsi apt repository …"
curl -sL https://download.jitsi.org/jitsi-key.gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/jitsi-key.gpg
echo "deb [signed-by=/usr/share/keyrings/jitsi-key.gpg] \
  https://download.jitsi.org stable/" \
  > /etc/apt/sources.list.d/jitsi-stable.list
apt-get update -y

# ── 5. Set hostname ───────────────────────────────────────────────────────────
log "Setting hostname to $DOMAIN …"
hostnamectl set-hostname "$DOMAIN"
grep -qF "$DOMAIN" /etc/hosts || echo "127.0.0.1  $DOMAIN" >> /etc/hosts

# ── 6. Install Jitsi Meet (non-interactive) ───────────────────────────────────
log "Installing Jitsi Meet …"
debconf-set-selections <<< "jitsi-meet jitsi-meet/jvb-hostname string $DOMAIN"
debconf-set-selections <<< "jitsi-meet jitsi-meet/cert-choice select Generate a new self-signed certificate (You will later get a chance to obtain a Let's encrypt certificate)"
DEBIAN_FRONTEND=noninteractive apt-get install -y jitsi-meet

# ── 7. Obtain Let's Encrypt TLS certificate ───────────────────────────────────
log "Obtaining Let's Encrypt certificate for $DOMAIN …"
/usr/share/jitsi-meet/scripts/install-letsencrypt-cert.sh "$EMAIL" "$DOMAIN"

# ── 8. Configure Prosody for JWT authentication ───────────────────────────────
log "Patching Prosody config for JWT + Jibri …"
PROSODY_CFG="/etc/prosody/conf.avail/${DOMAIN}.cfg.lua"
[[ -f "$PROSODY_CFG" ]] || die "Prosody config not found: $PROSODY_CFG"

# Install lua-jwt library (needed for mod_auth_token)
apt-get install -y lua-jwt 2>/dev/null || true
if ! dpkg -l | grep -q luarocks 2>/dev/null; then
  apt-get install -y luarocks
fi
luarocks install luajwtjitsi 2>/dev/null || true
luarocks install lua-cjson 2>/dev/null || true

# Patch main VirtualHost: anonymous → token auth, inject app_id/app_secret
python3 - <<PYEOF
import re

path = "/etc/prosody/conf.avail/${DOMAIN}.cfg.lua"
with open(path) as f:
    text = f.read()

# Replace both forms of anonymous auth
text = re.sub(r'authentication\s*=\s*"anonymous"', 'authentication = "token"', text)
text = re.sub(r'authentication\s*=\s*"jitsi-anonymous"', 'authentication = "token"', text)

# Inject JWT keys after 'authentication = "token"' in the main VirtualHost block
# Only inject once, before the first VirtualHost closing brace
inject = """
    app_id = "${APP_ID}";
    app_secret = "${APP_SECRET}";
    allow_empty_token = false;
"""
if 'app_id' not in text:
    text = text.replace('authentication = "token";', 'authentication = "token";' + inject, 1)

# Ensure token_verification is in the conference component modules
if 'token_verification' not in text:
    text = re.sub(
        r'(Component\s+"conference\.[^"]+"\s+"muc"\s*\n[^}]*modules_enabled\s*=\s*\{)',
        r'\1\n            "token_verification";',
        text
    )

with open(path, "w") as f:
    f.write(text)
print("Prosody JWT config patched.")
PYEOF

# ── 9. Add Prosody virtual hosts + components for Jibri ──────────────────────
# These must be appended to the domain config file
cat >> "$PROSODY_CFG" <<LUA

-- ── Jibri: internal MUC for Jibri brewery ─────────────────────────────────
Component "internal.auth.${DOMAIN}" "muc"
    storage = "memory"
    modules_enabled = { "ping" }
    admins = { "focus@auth.${DOMAIN}", "jibri@auth.${DOMAIN}" }
    muc_room_locking = false
    muc_room_default_public_jids = true

-- ── Jibri: recorder virtual host ──────────────────────────────────────────
VirtualHost "recorder.${DOMAIN}"
    modules_enabled = { "ping" }
    authentication = "internal_hashed"
LUA

# ── 10. Register Jibri XMPP accounts in Prosody ──────────────────────────────
log "Registering Jibri XMPP accounts in Prosody …"
# Restart prosody first so it picks up the new virtual hosts
systemctl restart prosody
sleep 3

prosodyctl register "jibri"    "auth.${DOMAIN}"     "$JIBRI_AUTH_PASS"
prosodyctl register "recorder" "recorder.${DOMAIN}" "$RECORDER_PASS"
log "Prosody accounts registered."

# ── 11. Patch Jicofo: JWT auth + Jibri brewery ───────────────────────────────
log "Configuring Jicofo for JWT + Jibri …"
JICOFO_CONF="/etc/jitsi/jicofo/jicofo.conf"

python3 - <<PYEOF2
import re

path = "${JICOFO_CONF}"
try:
    with open(path) as f:
        text = f.read()
except FileNotFoundError:
    text = ""

# Add/replace the jicofo block
block = """
jicofo {
  authentication {
    enabled = true
    type = JWT
    login-url = "${DOMAIN}"
  }
  jibri {
    brewery-jid = "JibriBrewery@internal.auth.${DOMAIN}"
    pending-timeout = 90 seconds
  }
}
"""
# Remove existing jicofo block if present, then append fresh one
text = re.sub(r'jicofo\s*\{[^}]*\}', '', text, flags=re.DOTALL)
text = text.strip() + "\n" + block

with open(path, "w") as f:
    f.write(text)
print("Jicofo config patched.")
PYEOF2

# ── 12. Open firewall ports ───────────────────────────────────────────────────
log "Configuring firewall …"
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp   comment "HTTP (Let's Encrypt)"
  ufw allow 443/tcp  comment "HTTPS"
  ufw allow 4443/tcp comment "Jitsi Meet TURN/TLS"
  ufw allow 5349/tcp comment "TURN over TLS (fallback)"
  ufw allow 10000/udp comment "Jitsi Meet WebRTC media"
  ufw --force enable
  log "Firewall ports open: 80, 443, 4443, 5349 (TCP), 10000 (UDP)"
fi

# ── 13. Install Jibri system dependencies ─────────────────────────────────────
log "Installing Jibri system dependencies …"

# ALSA loopback audio module (Jibri uses it for audio capture)
log "Loading snd_aloop kernel module …"
modprobe snd_aloop || warn "snd_aloop load failed — may need a reboot first"
grep -qxF "snd_aloop" /etc/modules || echo "snd_aloop" >> /etc/modules
log "snd_aloop added to /etc/modules (persists on reboot)"

# X virtual framebuffer (Jibri renders Chrome headlessly via Xvfb)
apt-get install -y xvfb alsa-utils

# Google Chrome stable (Jibri requires Chrome — NOT Chromium)
log "Installing Google Chrome stable …"
wget -q -O /tmp/chrome.deb \
  "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
apt-get install -y /tmp/chrome.deb
rm -f /tmp/chrome.deb
google-chrome --version
log "Chrome installed: $(google-chrome --version)"

# AWS CLI v2 (used by jibri-finalize.sh to upload recordings to R2)
log "Installing AWS CLI v2 …"
if ! command -v aws &>/dev/null; then
  curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp/awscli
  /tmp/awscli/aws/install
  rm -rf /tmp/awscliv2.zip /tmp/awscli
  log "AWS CLI installed: $(aws --version)"
else
  log "AWS CLI already installed: $(aws --version)"
fi

# ── 14. Install Jibri ─────────────────────────────────────────────────────────
log "Installing Jibri …"
apt-get install -y jibri

# Add jibri user to required groups
usermod -aG audio,video jibri 2>/dev/null || true

# Create recordings directory
mkdir -p /srv/recordings
chown jibri:jibri /srv/recordings
chmod 750 /srv/recordings

# ── 15. Write jibri.conf ──────────────────────────────────────────────────────
log "Writing /etc/jitsi/jibri/jibri.conf …"
mkdir -p /etc/jitsi/jibri

cat > /etc/jitsi/jibri/jibri.conf <<JIBRICONF
jibri {
  // A unique identifier for this Jibri instance
  id = "jibri-1"

  // Return to idle after each recording (false = handle one at a time but stay running)
  single-use-mode = false

  api {
    http {
      external-api-port = 2222
      internal-api-port = 3333
    }
    xmpp {
      environments = [
        {
          name = "prod environment"
          xmpp-server-hosts = ["localhost"]
          xmpp-domain = "${DOMAIN}"

          control-muc {
            domain = "internal.auth.${DOMAIN}"
            room-name = "JibriBrewery"
            nickname = "jibri"
          }

          control-login {
            domain = "auth.${DOMAIN}"
            username = "jibri"
            password = "${JIBRI_AUTH_PASS}"
          }

          call-login {
            domain = "recorder.${DOMAIN}"
            username = "recorder"
            password = "${RECORDER_PASS}"
          }

          // Strip the conference subdomain to derive the call URL
          strip-from-room-domain = "conference."
          trust-all-xmpp-certs = true
          usage-timeout = 0
        }
      ]
    }
  }

  recording {
    recordings-directory = "/srv/recordings"
    // Called after every recording finishes — uploads to R2 and notifies the app
    finalize-script = "/opt/kat/jibri-finalize.sh"
  }

  streaming {
    // No live streaming — leave empty
    rtmp-allow-list = []
  }

  chrome {
    flags = [
      "--use-fake-ui-for-media-stream",
      "--start-maximized",
      "--kiosk",
      "--enabled",
      "--disable-infobars",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-extensions",
      "--no-first-run",
      "--ignore-certificate-errors"
    ]
  }

  ffmpeg {
    resolution = "1280x720"
    framerate = 30
    video-encode-preset-recording = "ultrafast"
    h264-constant-rate-factor = 25
    audio-source = "alsa"
    audio-device = "plug:bsnoop"
  }

  stats {
    enable-stats-d = false
  }

  webhook {
    // No native Jibri webhook — the finalize script posts to the app directly
    subscribers = []
  }

  call-status-checks {
    no-media-timeout = 3 minutes
    all-muted-timeout = 10 minutes
    default-call-empty-timeout = 30 seconds
    ice-connection-timeout = 30 seconds
  }
}
JIBRICONF

chown jibri:jibri /etc/jitsi/jibri/jibri.conf
chmod 640 /etc/jitsi/jibri/jibri.conf

# ── 16. Add EnvironmentFile to Jibri systemd unit ────────────────────────────
log "Patching Jibri systemd unit to load /etc/jibri-env.sh …"
JIBRI_SVC="/etc/systemd/system/jibri.service"
if [[ ! -f "$JIBRI_SVC" ]]; then
  # Try the installed location
  JIBRI_SVC=$(systemctl show jibri -p FragmentPath 2>/dev/null | cut -d= -f2 || true)
fi

if [[ -f "$JIBRI_SVC" ]]; then
  # Add EnvironmentFile under [Service] if not already present
  if ! grep -q "EnvironmentFile" "$JIBRI_SVC"; then
    sed -i '/\[Service\]/a EnvironmentFile=/etc/jibri-env.sh' "$JIBRI_SVC"
    log "EnvironmentFile added to $JIBRI_SVC"
  fi
else
  warn "jibri.service file not found — you will need to add EnvironmentFile=/etc/jibri-env.sh manually."
fi

# ── 17. Place the finalize script ────────────────────────────────────────────
log "Installing finalize script to /opt/kat/ …"
mkdir -p /opt/kat
if [[ -f "/root/jibri-finalize.sh" ]]; then
  cp /root/jibri-finalize.sh /opt/kat/jibri-finalize.sh
  chmod +x /opt/kat/jibri-finalize.sh
  log "Finalize script installed."
else
  warn "jibri-finalize.sh not found at /root/jibri-finalize.sh"
  warn "Copy it manually: sudo cp jibri-finalize.sh /opt/kat/jibri-finalize.sh && sudo chmod +x /opt/kat/jibri-finalize.sh"
fi

# ── 18. Reload and restart all services ──────────────────────────────────────
log "Restarting all services …"
systemctl daemon-reload
systemctl restart prosody
sleep 2
systemctl restart jicofo
sleep 2
systemctl restart jitsi-videobridge2
sleep 2
systemctl enable jibri
systemctl restart jibri || warn "Jibri did not start — check: journalctl -u jibri -n 50"

# ── 19. Verify services ───────────────────────────────────────────────────────
echo ""
log "Service status:"
for svc in prosody jicofo jitsi-videobridge2 jibri; do
  STATUS=$(systemctl is-active "$svc" 2>/dev/null || echo "unknown")
  if [[ "$STATUS" == "active" ]]; then
    echo -e "  ${GREEN}✓${NC} $svc"
  else
    echo -e "  ${RED}✖${NC} $svc ($STATUS)"
  fi
done

# ── 20. Summary ───────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Installation COMPLETE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  DOMAIN:               $DOMAIN"
echo "  APP_ID:               $APP_ID"
echo "  APP_SECRET:           $APP_SECRET"
echo "  JIBRI_AUTH_PASS:      $JIBRI_AUTH_PASS  (Prosody account)"
echo "  RECORDER_PASS:        $RECORDER_PASS    (Prosody account)"
echo "  JIBRI_WEBHOOK_SECRET: $JIBRI_WEBHOOK_SECRET"
echo ""
echo "  ⚠  Add these to Vercel environment variables:"
echo "     JITSI_DOMAIN=$DOMAIN"
echo "     JITSI_APP_ID=$APP_ID"
echo "     JITSI_APP_SECRET=$APP_SECRET"
echo "     JIBRI_WEBHOOK_SECRET=$JIBRI_WEBHOOK_SECRET"
echo ""
echo "  Next steps:"
echo "  1. Fill in /etc/jibri-env.sh with your R2 credentials:"
echo "       KAT_APP_URL=https://dev.kindleatechie.com"
echo "       JIBRI_WEBHOOK_SECRET=$JIBRI_WEBHOOK_SECRET"
echo "       R2_ACCOUNT_ID=..."
echo "       R2_ACCESS_KEY_ID=..."
echo "       R2_SECRET_ACCESS_KEY=..."
echo "       R2_RECORDINGS_BUCKET=kat-recordings"
echo "       R2_RECORDINGS_PUBLIC_URL=https://pub-XXXX.r2.dev"
echo ""
echo "  2. Reload Jibri after editing /etc/jibri-env.sh:"
echo "       systemctl daemon-reload && systemctl restart jibri"
echo ""
echo "  3. Test a meeting at https://$DOMAIN"
echo "     and watch logs: journalctl -u jibri -f"
echo "═══════════════════════════════════════════════════════════════════"

# Save credentials to a file for reference
CREDS_FILE="/root/kat-jitsi-credentials.txt"
cat > "$CREDS_FILE" <<CREDS
# KAT Jitsi Credentials — generated $(date)
# Add to Vercel environment variables:

JITSI_DOMAIN=$DOMAIN
JITSI_APP_ID=$APP_ID
JITSI_APP_SECRET=$APP_SECRET
JIBRI_WEBHOOK_SECRET=$JIBRI_WEBHOOK_SECRET

# Internal Prosody account passwords (stored in jibri.conf — do not expose):
JIBRI_AUTH_PASS=$JIBRI_AUTH_PASS
RECORDER_PASS=$RECORDER_PASS
CREDS
chmod 600 "$CREDS_FILE"
log "Credentials saved to $CREDS_FILE"
