#!/bin/bash
# Runs ON the production server — triggered by `pnpm deploy` from your local machine.
# Pulls latest code, rebuilds, migrates the database, restarts the process.
set -e

APP_DIR="/var/www/merchant-realms"
cd "$APP_DIR"

echo "▶ Pulling latest code..."
git pull origin main

echo "▶ Installing dependencies..."
pnpm install --frozen-lockfile

echo "▶ Generating Prisma client..."
pnpm --filter server db:generate

echo "▶ Building..."
pnpm build

echo "▶ Running database migrations..."
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.production | cut -d'=' -f2-)
pnpm db:migrate:prod

echo "▶ Restarting server..."
pm2 restart merchant-realms --update-env

echo ""
echo "✓ Deploy complete"
pm2 status
