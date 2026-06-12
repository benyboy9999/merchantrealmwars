#!/bin/bash
set -e

echo "🔄 Resetting Merchant Realms dev environment..."

# Stop and remove containers + volumes
docker-compose down -v

# Restart postgres
docker-compose up -d postgres

# Wait for postgres to be ready
echo "⏳ Waiting for postgres..."
until docker-compose exec -T postgres pg_isready -U merchant_realms; do
  sleep 1
done

# Re-run migrations
echo "🗄  Running migrations..."
cd packages/server
/Users/kieran/Library/pnpm/bin/pnpm db:migrate

# Seed
echo "🌱 Seeding database..."
/Users/kieran/Library/pnpm/bin/pnpm db:seed

cd ../..
echo "✅ Dev environment reset complete."
