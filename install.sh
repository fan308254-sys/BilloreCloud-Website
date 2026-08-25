#!/usr/bin/env bash
set -euo pipefail

# BilloreCloud one-command VPS installer
# Usage:
# bash <(curl -fsSL https://raw.githubusercontent.com/fan308254-sys/BilloreCloud-Website/main/install.sh)

APP_DIR="${APP_DIR:-/opt/billorecloud}"
SERVICE="${SERVICE:-billorecloud}"
REPO="https://github.com/fan308254-sys/BilloreCloud-Website.git"

if [[ $EUID -ne 0 ]]; then
  echo "Please run this installer as root."; exit 1
fi

apt-get update -y
apt-get install -y git curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install Node.js first, then run this installer again."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20+ required; found $(node -v)"; exit 1
fi

mkdir -p "$APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard origin/main
else
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
npm install --omit=dev

if [[ ! -f .env ]]; then
  touch .env
fi

cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=BilloreCloud Website and Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) $APP_DIR/bin/www
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo
 echo "=========================================="
echo " BilloreCloud installation complete"
echo "=========================================="
echo "App:     $APP_DIR"
echo "Service: $SERVICE"
echo "Status:  systemctl status $SERVICE"
echo "Logs:    journalctl -u $SERVICE -f"
echo "Config:  $APP_DIR/.env"
echo
 echo "Add your secrets to .env before using Discord/payment integrations."
