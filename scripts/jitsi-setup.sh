#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Jitsi Meet + Jibri setup script
# Run on a fresh Ubuntu 22.04 VPS as root (or with sudo).
#
# Usage:
#   chmod +x jitsi-setup.sh
#   sudo ./jitsi-setup.sh
#
# You will be prompted for:
#   DOMAIN         — your Jitsi domain,   e.g. meet.yourdomain.com
#   APP_ID         — JWT app ID,          e.g. kat-app
#   APP_SECRET     — JWT app secret       (generate with: openssl rand -hex 32)
#   EMAIL          — for Let's Encrypt TLS certificate
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── 0. Gather config ─────────────────────────────────────────────────────────
read -rp "Jitsi domain (e.g. meet.yourdomain.com): " DOMAIN
read -rp "JWT App ID (e.g. kat-app):               " APP_ID
read -rp "JWT App Secret (leave blank to generate): " APP_SECRET
if [[ -z "$APP_SECRET" ]]; then
  APP_SECRET=$(openssl rand -hex 32)
  echo "  → Generated APP_SECRET: $APP_SECRET"
  echo "  ⚠  Save this — you need it in JITSI_APP_SECRET on Vercel."
fi
read -rp "Email for Let's Encrypt TLS:             " EMAIL

echo ""
echo "► Installing Jitsi Meet on $DOMAIN …"
echo ""

# ── 1. System prep ────────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y curl gnupg2 apt-transport-https

# Set hostname
hostnamectl set-hostname "$DOMAIN"
echo "127.0.0.1  $DOMAIN" >> /etc/hosts

# ── 2. Add Jitsi repo ────────────────────────────────────────────────────────
curl -sL https://download.jitsi.org/jitsi-key.gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/jitsi-key.gpg
echo "deb [signed-by=/usr/share/keyrings/jitsi-key.gpg] \
  https://download.jitsi.org stable/" \
  > /etc/apt/sources.list.d/jitsi-stable.list
apt-get update -y

# ── 3. Install Jitsi Meet (will prompt for domain + cert during install) ──────
# Seed debconf so the installer runs non-interactively
debconf-set-selections <<< "jitsi-meet jitsi-meet/jvb-hostname string $DOMAIN"
debconf-set-selections <<< "jitsi-meet jitsi-meet/cert-choice select Generate a new self-signed certificate"
DEBIAN_FRONTEND=noninteractive apt-get install -y jitsi-meet

# ── 4. Get a real Let's Encrypt cert ─────────────────────────────────────────
/usr/share/jitsi-meet/scripts/install-letsencrypt-cert.sh "$EMAIL" "$DOMAIN"

# ── 5. Enable JWT auth in Prosody ────────────────────────────────────────────
PROSODY_CFG="/etc/prosody/conf.avail/${DOMAIN}.cfg.lua"

echo "► Patching Prosody config for JWT …"

# Install lua-jwt library
apt-get install -y lua-jwt || true
# Jitsi ships its own; make sure it's present
if ! luarocks list 2>/dev/null | grep -q jwt; then
  apt-get install -y luarocks
  luarocks install lua-cjson 2>/dev/null || true
  luarocks install luajwtjitsi 2>/dev/null || true
fi

# Replace authentication = "anonymous" with token auth
sed -i 's/authentication = "anonymous"/authentication = "token"/' "$PROSODY_CFG"
sed -i 's/authentication = "jitsi-anonymous"/authentication = "token"/' "$PROSODY_CFG"

# Inject app_id / app_secret after the authentication line
python3 - <<PYEOF
import re, sys

path = "/etc/prosody/conf.avail/${DOMAIN}.cfg.lua"
with open(path) as f:
    text = f.read()

# Insert after 'authentication = "token"'
inject = '''
    app_id = "${APP_ID}";
    app_secret = "${APP_SECRET}";
    allow_empty_token = false;
'''
text = text.replace('authentication = "token";', 'authentication = "token";' + inject, 1)

with open(path, "w") as f:
    f.write(text)
print("Prosody config patched.")
PYEOF

# ── 6. Enable token auth module in Prosody virtual hosts ─────────────────────
# Ensure mod_auth_token is in the modules list for the main vhost
sed -i '/modules_enabled = {/,/}/ s|"bosh";|"bosh";\n        "mod_auth_token";|' "$PROSODY_CFG" || true

# ── 7. Patch Jicofo to require JWT ───────────────────────────────────────────
JICOFO_CONF="/etc/jitsi/jicofo/jicofo.conf"
if [[ -f "$JICOFO_CONF" ]]; then
  # Add authentication config block if not present
  if ! grep -q "authentication" "$JICOFO_CONF"; then
    cat >> "$JICOFO_CONF" <<JICOFO
jicofo {
  authentication {
    enabled = true
    type = JWT
    login-url = "$DOMAIN"
  }
}
JICOFO
  fi
fi

# ── 8. Restart services ───────────────────────────────────────────────────────
echo "► Restarting Jitsi services …"
systemctl restart prosody
systemctl restart jicofo
systemctl restart jitsi-videobridge2

# ── 9. Open firewall ports ────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 4443/tcp
  ufw allow 10000/udp
  ufw --force enable
fi

# ── 10. Install Jibri ────────────────────────────────────────────────────────
echo ""
echo "► Installing Jibri …"

apt-get install -y jibri ffmpeg

# Create Jibri config dir
mkdir -p /etc/jitsi/jibri

cat > /etc/jitsi/jibri/jibri.conf <<JIBRI
jibri {
  id = ""
  single-use-mode = false

  api {
    http {
      host = "localhost"
      port = 2222
    }
    internal-http {
      host = "localhost"
      port = 3333
    }
  }

  recording {
    recordings-directory = "/srv/recordings"
    finalize-script = "/opt/kat/jibri-finalize.sh"
  }

  streaming {
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

  stats {
    enable-stats-d = false
  }

  webhook {
    subscribers = []
  }

  xmpp-environments = [
    {
      name = "prod environment"
      xmpp-server-hosts = ["localhost"]
      xmpp-domain = "${DOMAIN}"
      control-login {
        domain = "auth.${DOMAIN}"
        username = "jibri"
        password = "$(openssl rand -hex 16)"
      }
      control-muc {
        domain = "internal.auth.${DOMAIN}"
        room-name = "JibriBrewery"
        nickname = "jibri"
      }
      call-login {
        domain = "recorder.${DOMAIN}"
        username = "recorder"
        password = "$(openssl rand -hex 16)"
      }
      strip-from-room-domain = "conference."
      use-recording-prefix = true
      trust-all-xmpp-certs = true
    }
  ]
}
JIBRI

# Create recordings directory
mkdir -p /srv/recordings
chown jibri:jibri /srv/recordings 2>/dev/null || true

# ── 11. Write the finalize script ─────────────────────────────────────────────
mkdir -p /opt/kat
cat > /opt/kat/jibri-finalize.sh <<'FINALIZE_PLACEHOLDER'
# This file will be overwritten by jibri-finalize.sh — copy it next.
FINALIZE_PLACEHOLDER
chmod +x /opt/kat/jibri-finalize.sh

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Jitsi Meet + Jibri installation COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo " DOMAIN:      $DOMAIN"
echo " APP_ID:      $APP_ID"
echo " APP_SECRET:  $APP_SECRET"
echo ""
echo " ⚠  Add these to Vercel environment variables:"
echo "    JITSI_DOMAIN=$DOMAIN"
echo "    JITSI_APP_ID=$APP_ID"
echo "    JITSI_APP_SECRET=$APP_SECRET"
echo ""
echo " Next step: copy jibri-finalize.sh to /opt/kat/jibri-finalize.sh"
echo "            and fill in your R2 + webhook credentials inside it."
echo "═══════════════════════════════════════════════════════════"
