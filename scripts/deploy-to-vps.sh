#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Deploy Jibri scripts to your VPS
#
# Run from your local machine (where this repo lives):
#   chmod +x scripts/deploy-to-vps.sh
#   ./scripts/deploy-to-vps.sh
#
# Prerequisites on your local machine: ssh, scp
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

read -rp "VPS user@host (e.g. root@123.45.67.89): " VPS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "► Copying setup script …"
scp "$SCRIPT_DIR/jitsi-setup.sh"    "$VPS:/root/jitsi-setup.sh"
scp "$SCRIPT_DIR/jibri-finalize.sh" "$VPS:/root/jibri-finalize.sh"
scp "$SCRIPT_DIR/jibri-env.sh"      "$VPS:/root/jibri-env.sh"

echo "► Setting permissions …"
ssh "$VPS" "chmod +x /root/jitsi-setup.sh /root/jibri-finalize.sh"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Files copied to $VPS:"
echo "   /root/jitsi-setup.sh     — run this first (as root)"
echo "   /root/jibri-finalize.sh  — Jibri post-recording script"
echo "   /root/jibri-env.sh       — fill in secrets, then:"
echo "                              cp /root/jibri-env.sh /etc/jibri-env.sh"
echo ""
echo " On the VPS, run:"
echo "   sudo bash /root/jitsi-setup.sh"
echo ""
echo " After setup, move the finalize script:"
echo "   sudo mkdir -p /opt/kat"
echo "   sudo cp /root/jibri-finalize.sh /opt/kat/jibri-finalize.sh"
echo "   sudo chmod +x /opt/kat/jibri-finalize.sh"
echo ""
echo " Then fill in /etc/jibri-env.sh and add to jibri.service:"
echo "   EnvironmentFile=/etc/jibri-env.sh"
echo "   systemctl daemon-reload && systemctl restart jibri"
echo "═══════════════════════════════════════════════════════════"
