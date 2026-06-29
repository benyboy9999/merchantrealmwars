-- Drop old chat infrastructure
DROP TABLE IF EXISTS "ChatMessage";
DROP TYPE IF EXISTS "ChatChannelType";

-- Create ChatRoom
CREATE TABLE "ChatRoom" (
    "id"        SERIAL NOT NULL,
    "type"      TEXT NOT NULL,
    "name"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatRoom_type_idx" ON "ChatRoom"("type");

-- Create ChatRoomMember
CREATE TABLE "ChatRoomMember" (
    "id"         SERIAL NOT NULL,
    "chatRoomId" INTEGER NOT NULL,
    "empireId"   INTEGER NOT NULL,
    "mutedAt"    TIMESTAMP(3),
    "joinedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatRoomMember_chatRoomId_empireId_key" ON "ChatRoomMember"("chatRoomId", "empireId");
CREATE INDEX "ChatRoomMember_empireId_idx" ON "ChatRoomMember"("empireId");

ALTER TABLE "ChatRoomMember"
    ADD CONSTRAINT "ChatRoomMember_chatRoomId_fkey"
        FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomMember"
    ADD CONSTRAINT "ChatRoomMember_empireId_fkey"
        FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create new ChatMessage
CREATE TABLE "ChatMessage" (
    "id"         SERIAL NOT NULL,
    "chatRoomId" INTEGER NOT NULL,
    "empireId"   INTEGER,
    "content"    VARCHAR(500) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_chatRoomId_createdAt_idx" ON "ChatMessage"("chatRoomId", "createdAt");

ALTER TABLE "ChatMessage"
    ADD CONSTRAINT "ChatMessage_chatRoomId_fkey"
        FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage"
    ADD CONSTRAINT "ChatMessage_empireId_fkey"
        FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the General room
INSERT INTO "ChatRoom" ("type", "name") VALUES ('GENERAL', 'General');

-- Add all existing empires to the General room
INSERT INTO "ChatRoomMember" ("chatRoomId", "empireId")
SELECT 1, "id" FROM "Empire";
