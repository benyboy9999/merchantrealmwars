#!/bin/bash
# First-time staging setup. Run once on the production server as the mr user.
# Usage (from local): pnpm staging:setup
set -e

PROD_DIR="/var/www/merchant-realms"
STAGING_DIR="/var/www/merchant-realms-staging"

# ── Clone ────────────────────────────────────────────────────────────────────
if [ ! -d "$STAGING_DIR/.git" ]; then
  echo "▶ Cloning from production repo..."
  git clone "$PROD_DIR" "$STAGING_DIR"
  cd "$STAGING_DIR"
  git remote set-url origin "$(cd "$PROD_DIR" && git remote get-url origin)"
else
  cd "$STAGING_DIR"
fi

# ── Install ──────────────────────────────────────────────────────────────────
echo "▶ Installing dependencies..."
pnpm install --frozen-lockfile

# ── Staging database ─────────────────────────────────────────────────────────
echo "▶ Creating staging database..."
sudo -u postgres createdb merchant_realms_staging 2>/dev/null \
  || echo "  Database already exists — skipping."

PROD_DB_USER=$(grep '^DATABASE_URL=' "$PROD_DIR/.env.production" \
  | sed 's|.*postgresql://\([^:]*\):.*|\1|')
sudo -u postgres psql -c \
  "GRANT ALL PRIVILEGES ON DATABASE merchant_realms_staging TO \"$PROD_DB_USER\";" \
  2>/dev/null || true

# ── .env.staging ─────────────────────────────────────────────────────────────
if [ ! -f .env.staging ]; then
  echo "▶ Creating .env.staging..."
  PROD_DB_URL=$(grep '^DATABASE_URL=' "$PROD_DIR/.env.production" | cut -d'=' -f2-)
  STAGING_DB_URL=$(echo "$PROD_DB_URL" | sed 's|/[^/?]*\(\?.*\)\?$|/merchant_realms_staging|')
  PROD_JWT=$(grep '^JWT_SECRET=' "$PROD_DIR/.env.production" | cut -d'=' -f2-)
  PROD_GOOGLE=$(grep '^GOOGLE_CLIENT_ID=' "$PROD_DIR/.env.production" | cut -d'=' -f2-)

  cat > .env.staging <<EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=${STAGING_DB_URL}
JWT_SECRET=${PROD_JWT}-staging
GOOGLE_CLIENT_ID=${PROD_GOOGLE}
TICK_INTERVAL_SECONDS=30
ENABLE_DEBUG_ENDPOINTS=true
EOF
  echo "  Created .env.staging — review at $STAGING_DIR/.env.staging"
else
  echo "  .env.staging already exists — skipping."
fi

# ── Build ────────────────────────────────────────────────────────────────────
echo "▶ Generating Prisma client..."
pnpm --filter server db:generate

echo "▶ Building..."
pnpm build

# ── Migrate ──────────────────────────────────────────────────────────────────
echo "▶ Running database migrations..."
set -a; source .env.staging; set +a
pnpm db:migrate:prod

# ── PM2 ──────────────────────────────────────────────────────────────────────
echo "▶ Starting staging pm2 process..."
set -a; source .env.staging; set +a
pm2 describe merchant-realms-staging > /dev/null 2>&1 \
  && pm2 restart merchant-realms-staging --update-env \
  || pm2 start packages/server/dist/app.js \
       --name merchant-realms-staging \
       --cwd "$STAGING_DIR"
pm2 save

echo ""
echo "✓ Staging setup complete!"
echo ""
echo "Remaining manual steps:"
echo "  1. nginx: copy infrastructure/nginx/nginx-staging.conf to /etc/nginx/conf.d/staging.conf"
echo "            then: sudo nginx -t && sudo nginx -s reload"
echo "  2. DNS:   add A record  dev.merchantrealmwars.com → your server IP"
echo "  3. Google OAuth: add http://dev.merchantrealmwars.com to authorized origins"
echo "  4. Test at http://dev.merchantrealmwars.com"
