#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KAT — Deploy Judge0 CE setup script to your VPS
#
# Run from your local machine (inside the app/ directory):
#   chmod +x scripts/judge0/deploy-to-vps.sh
#   ./scripts/judge0/deploy-to-vps.sh
#
# Prerequisites on your local machine: ssh, scp
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

read -rp "VPS user@host (e.g. james@123.45.67.89): " VPS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPS_USER=$(echo "$VPS" | cut -d@ -f1)
VPS_HOME="/home/${VPS_USER}"

echo "► Copying Judge0 setup script to ${VPS_HOME} …"
scp "$SCRIPT_DIR/judge0-setup.sh" "$VPS:${VPS_HOME}/judge0-setup.sh"

echo "► Setting permissions …"
ssh "$VPS" "chmod +x ${VPS_HOME}/judge0-setup.sh"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " File copied to $VPS:"
echo "   ${VPS_HOME}/judge0-setup.sh"
echo ""
echo " On the VPS, run:"
echo "   sudo bash ${VPS_HOME}/judge0-setup.sh"
echo ""
echo " You will be prompted for:"
echo "   - Judge0 domain  (e.g. code.yourdomain.com)"
echo "   - Email          (for Let's Encrypt TLS)"
echo ""
echo " After the script finishes, add these to Vercel:"
echo "   JUDGE0_API_URL=https://code.yourdomain.com"
echo "   JUDGE0_API_KEY=<printed at end of script>"
echo "═══════════════════════════════════════════════════════════"
