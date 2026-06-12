-- CreateEnum
CREATE TYPE "RegionId" AS ENUM ('CENTRAL', 'EXTRACTION', 'FARMING', 'CRAFTING');

-- CreateEnum
CREATE TYPE "RegionBonusType" AS ENUM ('NONE', 'EXTRACTION', 'FARMING', 'CRAFTING');

-- CreateEnum
CREATE TYPE "CaravanStatus" AS ENUM ('IDLE', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "CaravanLocationType" AS ENUM ('KEEP', 'EXCHANGE', 'PLOT');

-- CreateEnum
CREATE TYPE "WorkerTier" AS ENUM ('T1', 'T2', 'T3');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionOrderType" AS ENUM ('INFINITE', 'NUMERICAL');

-- CreateEnum
CREATE TYPE "GuildRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('GLOBAL', 'GUILD', 'REGION');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bonusType" "RegionBonusType" NOT NULL,
    "guildControllable" BOOLEAN NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bonusDescription" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bonusDescription" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empire" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goldBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keep" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buildingSlotCount" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "keepId" TEXT NOT NULL,
    "buildingType" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "slotIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDormant" BOOLEAN NOT NULL DEFAULT false,
    "health" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "workersAssigned" INTEGER NOT NULL DEFAULT 0,
    "productionProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceLedger" (
    "id" TEXT NOT NULL,
    "keepId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "keepId" TEXT NOT NULL,
    "buildingType" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "orderType" "ProductionOrderType" NOT NULL,
    "targetQuantity" DOUBLE PRECISION,
    "producedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerConsumptionLog" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "tickId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "required" DOUBLE PRECISION NOT NULL,
    "actual" DOUBLE PRECISION NOT NULL,
    "penaltyApplied" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WorkerConsumptionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caravan" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Caravan',
    "animalType" TEXT NOT NULL DEFAULT 'MULE',
    "animalCount" INTEGER NOT NULL DEFAULT 1,
    "locationType" "CaravanLocationType" NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "CaravanStatus" NOT NULL DEFAULT 'IDLE',
    "destType" "CaravanLocationType",
    "destId" TEXT,
    "departedAt" TIMESTAMP(3),
    "arrivesAt" TIMESTAMP(3),

    CONSTRAINT "Caravan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaravanCargo" (
    "id" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CaravanCargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeStorage" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ExchangeStorage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOrder" (
    "id" TEXT NOT NULL,
    "empireId" TEXT,
    "regionId" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "fulfilledQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTrade" (
    "id" TEXT NOT NULL,
    "buyOrderId" TEXT NOT NULL,
    "sellOrderId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "tradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "goldBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "GuildRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionControl" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "controlStart" TIMESTAMP(3) NOT NULL,
    "controlEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialisationTree" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "SpecialisationTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialisationNode" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "bonusDescription" TEXT NOT NULL,
    "recipeUnlocks" JSONB NOT NULL DEFAULT '[]',
    "cost" JSONB NOT NULL,

    CONSTRAINT "SpecialisationNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpireSpecialisation" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpireSpecialisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "channelType" "ChatChannelType" NOT NULL,
    "channelId" TEXT,
    "content" VARCHAR(500) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTick" (
    "id" TEXT NOT NULL,
    "tickNumber" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "GameTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCollection" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "tickId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "guildShare" DOUBLE PRECISION NOT NULL,
    "treasuryShare" DOUBLE PRECISION NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingUpkeepLog" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "keepId" TEXT NOT NULL,
    "tickId" TEXT NOT NULL,
    "required" JSONB NOT NULL,
    "actual" JSONB NOT NULL,
    "isDormant" BOOLEAN NOT NULL,

    CONSTRAINT "BuildingUpkeepLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_playerId_idx" ON "RefreshToken"("playerId");

-- CreateIndex
CREATE INDEX "District_regionId_idx" ON "District"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "District_q_r_key" ON "District"("q", "r");

-- CreateIndex
CREATE INDEX "Plot_districtId_idx" ON "Plot"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Empire_playerId_key" ON "Empire"("playerId");

-- CreateIndex
CREATE INDEX "Keep_empireId_idx" ON "Keep"("empireId");

-- CreateIndex
CREATE INDEX "Building_keepId_idx" ON "Building"("keepId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_keepId_slotIndex_key" ON "Building"("keepId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceLedger_keepId_resourceType_key" ON "ResourceLedger"("keepId", "resourceType");

-- CreateIndex
CREATE INDEX "ProductionOrder_keepId_buildingType_position_idx" ON "ProductionOrder"("keepId", "buildingType", "position");

-- CreateIndex
CREATE INDEX "WorkerConsumptionLog_empireId_tickId_idx" ON "WorkerConsumptionLog"("empireId", "tickId");

-- CreateIndex
CREATE INDEX "Caravan_empireId_idx" ON "Caravan"("empireId");

-- CreateIndex
CREATE INDEX "Caravan_status_arrivesAt_idx" ON "Caravan"("status", "arrivesAt");

-- CreateIndex
CREATE INDEX "CaravanCargo_caravanId_idx" ON "CaravanCargo"("caravanId");

-- CreateIndex
CREATE UNIQUE INDEX "CaravanCargo_caravanId_resourceType_key" ON "CaravanCargo"("caravanId", "resourceType");

-- CreateIndex
CREATE INDEX "ExchangeStorage_empireId_idx" ON "ExchangeStorage"("empireId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeStorage_empireId_regionId_resourceType_key" ON "ExchangeStorage"("empireId", "regionId", "resourceType");

-- CreateIndex
CREATE INDEX "MarketOrder_regionId_resourceType_status_idx" ON "MarketOrder"("regionId", "resourceType", "status");

-- CreateIndex
CREATE INDEX "MarketOrder_empireId_idx" ON "MarketOrder"("empireId");

-- CreateIndex
CREATE INDEX "MarketTrade_tradedAt_idx" ON "MarketTrade"("tradedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_playerId_key" ON "GuildMember"("playerId");

-- CreateIndex
CREATE INDEX "GuildMember_guildId_idx" ON "GuildMember"("guildId");

-- CreateIndex
CREATE INDEX "RegionControl_guildId_idx" ON "RegionControl"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "RegionControl_regionId_weekNumber_key" ON "RegionControl"("regionId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialisationTree_name_key" ON "SpecialisationTree"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialisationNode_treeId_level_key" ON "SpecialisationNode"("treeId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "EmpireSpecialisation_empireId_nodeId_key" ON "EmpireSpecialisation"("empireId", "nodeId");

-- CreateIndex
CREATE INDEX "ChatMessage_channelType_channelId_sentAt_idx" ON "ChatMessage"("channelType", "channelId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameTick_tickNumber_key" ON "GameTick"("tickNumber");

-- CreateIndex
CREATE INDEX "BuildingUpkeepLog_buildingId_idx" ON "BuildingUpkeepLog"("buildingId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empire" ADD CONSTRAINT "Empire_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keep" ADD CONSTRAINT "Keep_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keep" ADD CONSTRAINT "Keep_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceLedger" ADD CONSTRAINT "ResourceLedger_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerConsumptionLog" ADD CONSTRAINT "WorkerConsumptionLog_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerConsumptionLog" ADD CONSTRAINT "WorkerConsumptionLog_tickId_fkey" FOREIGN KEY ("tickId") REFERENCES "GameTick"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caravan" ADD CONSTRAINT "Caravan_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanCargo" ADD CONSTRAINT "CaravanCargo_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "Caravan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeStorage" ADD CONSTRAINT "ExchangeStorage_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "MarketOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "MarketOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guild" ADD CONSTRAINT "Guild_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionControl" ADD CONSTRAINT "RegionControl_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionControl" ADD CONSTRAINT "RegionControl_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialisationNode" ADD CONSTRAINT "SpecialisationNode_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "SpecialisationTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpireSpecialisation" ADD CONSTRAINT "EmpireSpecialisation_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpireSpecialisation" ADD CONSTRAINT "EmpireSpecialisation_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SpecialisationNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCollection" ADD CONSTRAINT "TaxCollection_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCollection" ADD CONSTRAINT "TaxCollection_tickId_fkey" FOREIGN KEY ("tickId") REFERENCES "GameTick"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingUpkeepLog" ADD CONSTRAINT "BuildingUpkeepLog_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingUpkeepLog" ADD CONSTRAINT "BuildingUpkeepLog_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
