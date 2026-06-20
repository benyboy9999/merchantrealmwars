-- PostgreSQL initialisation script — runs once on first container start.
-- Prisma handles schema migrations; this file handles DB-level setup only.

-- Enable UUID extension (used by Prisma cuid alternative if needed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- The user and database are created by Docker Compose env vars.
-- Grant privileges to ensure migrations work correctly.
GRANT ALL PRIVILEGES ON DATABASE merchant_realms_dev TO merchant_realms;
