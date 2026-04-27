#!/bin/bash
# Restore Pi-side config for the Unicorn Robot kiosk + thermal printer.
# Run from the repo root: `bash pi/restore.sh`
#
# Prerequisites (see pi/README.md): Pi OS Trixie with auto-login enabled,
# screen blanking off, nodejs/npm/pm2/chromium installed, TiMini-Print binary
# at ~/TiMini-Print-Command-Line-Linux-arm64, and the Bluetooth printer paired.

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "→ Restoring from $REPO_DIR"

# 1. Kiosk autostart
echo "→ Installing LXSession autostart"
mkdir -p ~/.config/lxsession/rpd-x
cp "$REPO_DIR/pi/config/lxsession-autostart" ~/.config/lxsession/rpd-x/autostart
chmod 644 ~/.config/lxsession/rpd-x/autostart

# 2. Print server
echo "→ Installing print-server.js + dependencies"
cp "$REPO_DIR/print-server.js" ~/print-server.js
cd ~
[ -d node_modules/express ] || npm install express

# 3. Crontab (only if a saved one exists and is non-empty)
if [ -s "$REPO_DIR/pi/config/crontab.txt" ]; then
    echo "→ Restoring crontab"
    crontab "$REPO_DIR/pi/config/crontab.txt"
fi

# 4. PM2 — start (or restart) the print server
echo "→ Starting print-server under PM2"
pm2 delete print-server >/dev/null 2>&1 || true
pm2 start ~/print-server.js --name print-server
pm2 save

# 5. PM2 boot persistence (runs once per machine; safe to re-run)
echo "→ Configuring PM2 boot persistence"
echo "    If prompted, copy and run the sudo command shown below:"
pm2 startup systemd -u "$USER" --hp "$HOME" || true

# 6. Sanity check
echo
echo "✓ Restore complete."
echo
echo "Verify:"
echo "  pm2 status                            # print-server should be online"
echo "  curl http://localhost:3001/           # should return JSON"
echo "  sudo reboot                           # then check kiosk auto-launches"


