#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wg-router}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_USER="${SERVICE_USER:-wgrouter}"
BIND_HOST="${BIND_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-3000}"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"

if [[ -z "$NODE_BIN" ]]; then
  echo "error: node not found in PATH (set NODE_BIN if needed)" >&2
  exit 1
fi

echo "==> Installing dependencies"
cd "$REPO_DIR"
npm ci 2>/dev/null || npm install

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Running database migrations"
npx prisma migrate deploy

echo "==> Building Next.js app"
npm run build

echo "==> Syncing standalone build to ${APP_DIR}"
sudo mkdir -p "$APP_DIR/.next"
sudo rsync -a --delete "$REPO_DIR/.next/standalone/" "$APP_DIR/"
sudo rsync -a --delete "$REPO_DIR/.next/static/" "$APP_DIR/.next/static/"
sudo rsync -a --delete "$REPO_DIR/public/" "$APP_DIR/public/"
sudo rsync -a --delete "$REPO_DIR/prisma/" "$APP_DIR/prisma/"

if [[ -f "$REPO_DIR/.env" ]]; then
  sudo install -m 600 "$REPO_DIR/.env" "$APP_DIR/.env"
fi

echo "==> Ensuring system user ${SERVICE_USER}"
if ! id "$SERVICE_USER" &>/dev/null; then
  sudo useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
sudo chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"

echo "==> Installing systemd unit"
sudo tee /etc/systemd/system/wg-router.service > /dev/null <<EOF
[Unit]
Description=WG Router Web App
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=HOSTNAME=${BIND_HOST}
Environment=PORT=${APP_PORT}
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

if systemctl is-active --quiet wg-router; then
  echo "==> Restarting wg-router"
  sudo systemctl restart wg-router
elif systemctl is-enabled --quiet wg-router 2>/dev/null; then
  echo "==> Starting wg-router"
  sudo systemctl start wg-router
else
  echo "==> Done. Enable and start with:"
  echo "    sudo systemctl enable --now wg-router"
fi
