#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Deploy Jitsi Meet + Jibri scripts to your VPS
#
# Run from your local machine (inside the app/ directory):
#   chmod +x scripts/jitsi-jibri/deploy-to-vps.sh
#   ./scripts/jitsi-jibri/deploy-to-vps.sh
#
# Prerequisites on your local machine: ssh, scp
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

read -rp "VPS user@host (e.g. james@123.45.67.89): " VPS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPS_USER=$(echo "$VPS" | cut -d@ -f1)
VPS_HOME="/home/${VPS_USER}"

echo "► Copying Jitsi/Jibri scripts to ${VPS_HOME} …"
scp "$SCRIPT_DIR/jitsi-setup.sh"    "$VPS:${VPS_HOME}/jitsi-setup.sh"
scp "$SCRIPT_DIR/jibri-finalize.sh" "$VPS:${VPS_HOME}/jibri-finalize.sh"
scp "$SCRIPT_DIR/jibri-env.sh"      "$VPS:${VPS_HOME}/jibri-env.sh"

echo "► Setting permissions …"
ssh "$VPS" "chmod +x ${VPS_HOME}/jitsi-setup.sh ${VPS_HOME}/jibri-finalize.sh"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Files copied to $VPS:"
echo "   ${VPS_HOME}/jitsi-setup.sh     — run this first"
echo "   ${VPS_HOME}/jibri-finalize.sh  — Jibri post-recording script"
echo "   ${VPS_HOME}/jibri-env.sh       — fill in secrets, then:"
echo "     sudo cp ${VPS_HOME}/jibri-env.sh /etc/jibri-env.sh"
echo ""
echo " On the VPS, run:"
echo "   sudo bash ${VPS_HOME}/jitsi-setup.sh"
echo ""
echo " Then fill in /etc/jibri-env.sh and reload Jibri:"
echo "   systemctl daemon-reload && systemctl restart jibri"
echo "═══════════════════════════════════════════════════════════"
