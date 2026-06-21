-- Make passwordHash nullable (Google users don't have one)
ALTER TABLE "Player" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Add googleId for Google OAuth users
ALTER TABLE "Player" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "Player_googleId_key" ON "Player"("googleId");
