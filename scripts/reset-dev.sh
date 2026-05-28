#!/bin/bash
set -e

echo "🔄 Resetting Artemis dev environment..."

# Stop and remove containers + volumes
docker-compose down -v

# Restart postgres
docker-compose up -d postgres

# Wait for postgres to be ready
echo "⏳ Waiting for postgres..."
until docker-compose exec -T postgres pg_isready -U artemis; do
  sleep 1
done

# Re-run migrations
echo "🗄  Running migrations..."
cd packages/server
pnpm db:migrate

# Seed
echo "🌱 Seeding database..."
pnpm db:seed

cd ../..
echo "✅ Dev environment reset complete."
