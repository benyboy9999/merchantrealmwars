#!/bin/bash
# Runs ON the production server — triggered by `pnpm staging:deploy` from local.
# Pulls latest main, rebuilds, migrates, restarts the staging pm2 process.
set -e

STAGING_DIR="/var/www/merchant-realms-staging"
cd "$STAGING_DIR"

echo "▶ Pulling latest code..."
git pull origin dev

echo "▶ Installing dependencies..."
pnpm install --frozen-lockfile

echo "▶ Generating Prisma client..."
pnpm --filter server db:generate

echo "▶ Building..."
pnpm build

echo "▶ Running database migrations..."
set -a; source .env.staging; set +a
pnpm db:migrate:prod

echo "▶ Restarting staging server..."
set -a; source .env.staging; set +a
pm2 restart merchant-realms-staging --update-env

echo ""
echo "✓ Staging deploy complete → http://dev.merchantrealmwars.com"
pm2 status merchant-realms-staging
