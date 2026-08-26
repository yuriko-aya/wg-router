#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wg-router}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

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

echo "==> Done. Start with: sudo systemctl restart wg-router"
