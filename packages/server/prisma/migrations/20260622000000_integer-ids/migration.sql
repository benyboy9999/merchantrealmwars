-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('KEEP', 'CARAVAN', 'EXCHANGE');

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
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "guildControllable" BOOLEAN NOT NULL,
    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "regionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "bonusDescription" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" SERIAL NOT NULL,
    "districtId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "bonusDescription" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "isCenter" BOOLEAN NOT NULL DEFAULT false,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlotTrait" (
    "id" SERIAL NOT NULL,
    "plotId" INTEGER NOT NULL,
    "traitType" TEXT NOT NULL,
    "baseValue" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "PlotTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "type" "WarehouseType" NOT NULL,
    "empireId" INTEGER NOT NULL,
    "regionId" INTEGER,
    "cap" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseItem" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarehouseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empire" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "goldBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Empire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keep" (
    "id" SERIAL NOT NULL,
    "empireId" INTEGER NOT NULL,
    "plotId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "buildingSlotCount" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouseId" INTEGER,
    CONSTRAINT "Keep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" SERIAL NOT NULL,
    "keepId" INTEGER NOT NULL,
    "buildingTypeId" INTEGER NOT NULL,
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
CREATE TABLE "ProductionOrder" (
    "id" SERIAL NOT NULL,
    "keepId" INTEGER NOT NULL,
    "buildingTypeId" INTEGER NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "orderType" "ProductionOrderType" NOT NULL,
    "targetQuantity" DOUBLE PRECISION,
    "producedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" SERIAL NOT NULL,
    "buildingId" INTEGER NOT NULL,
    "keepId" INTEGER NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completesAt" TIMESTAMP(3) NOT NULL,
    "progressAtUpdate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "speedSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caravan" (
    "id" SERIAL NOT NULL,
    "empireId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Caravan',
    "animalType" TEXT NOT NULL DEFAULT 'MULE',
    "animalCount" INTEGER NOT NULL DEFAULT 1,
    "locationType" "CaravanLocationType" NOT NULL,
    "locationId" INTEGER NOT NULL,
    "status" "CaravanStatus" NOT NULL DEFAULT 'IDLE',
    "destType" "CaravanLocationType",
    "destId" INTEGER,
    "departedAt" TIMESTAMP(3),
    "arrivesAt" TIMESTAMP(3),
    "warehouseId" INTEGER,
    CONSTRAINT "Caravan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOrder" (
    "id" SERIAL NOT NULL,
    "empireId" INTEGER,
    "regionId" INTEGER NOT NULL,
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
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "sellerEmpireId" INTEGER,
    "buyerEmpireId" INTEGER NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalGold" DOUBLE PRECISION NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "leaderId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "goldBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMember" (
    "id" SERIAL NOT NULL,
    "guildId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "role" "GuildRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictControl" (
    "id" SERIAL NOT NULL,
    "guildId" INTEGER NOT NULL,
    "districtId" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "controlStart" TIMESTAMP(3) NOT NULL,
    "controlEnd" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DistrictControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "channelType" "ChatChannelType" NOT NULL,
    "channelId" INTEGER,
    "content" VARCHAR(500) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTick" (
    "id" SERIAL NOT NULL,
    "tickNumber" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    CONSTRAINT "GameTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCollection" (
    "id" SERIAL NOT NULL,
    "regionId" INTEGER NOT NULL,
    "tickId" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "guildShare" DOUBLE PRECISION NOT NULL,
    "treasuryShare" DOUBLE PRECISION NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");
CREATE UNIQUE INDEX "Player_googleId_key" ON "Player"("googleId");

CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_playerId_idx" ON "RefreshToken"("playerId");

CREATE UNIQUE INDEX "District_q_r_key" ON "District"("q", "r");
CREATE INDEX "District_regionId_idx" ON "District"("regionId");

CREATE INDEX "Plot_districtId_idx" ON "Plot"("districtId");

CREATE UNIQUE INDEX "PlotTrait_plotId_traitType_key" ON "PlotTrait"("plotId", "traitType");
CREATE INDEX "PlotTrait_plotId_idx" ON "PlotTrait"("plotId");

CREATE INDEX "Warehouse_empireId_idx" ON "Warehouse"("empireId");
CREATE INDEX "Warehouse_empireId_regionId_idx" ON "Warehouse"("empireId", "regionId");

CREATE UNIQUE INDEX "WarehouseItem_warehouseId_resourceType_key" ON "WarehouseItem"("warehouseId", "resourceType");
CREATE INDEX "WarehouseItem_warehouseId_idx" ON "WarehouseItem"("warehouseId");

CREATE UNIQUE INDEX "Empire_playerId_key" ON "Empire"("playerId");

CREATE UNIQUE INDEX "Keep_warehouseId_key" ON "Keep"("warehouseId");
CREATE INDEX "Keep_empireId_idx" ON "Keep"("empireId");

CREATE UNIQUE INDEX "Building_keepId_slotIndex_key" ON "Building"("keepId", "slotIndex");
CREATE INDEX "Building_keepId_idx" ON "Building"("keepId");

CREATE INDEX "ProductionOrder_keepId_buildingTypeId_position_idx" ON "ProductionOrder"("keepId", "buildingTypeId", "position");
CREATE INDEX "Building_buildingTypeId_idx" ON "Building"("buildingTypeId");

CREATE UNIQUE INDEX "ProductionTask_buildingId_key" ON "ProductionTask"("buildingId");
CREATE INDEX "ProductionTask_completesAt_idx" ON "ProductionTask"("completesAt");
CREATE INDEX "ProductionTask_keepId_idx" ON "ProductionTask"("keepId");

CREATE UNIQUE INDEX "Caravan_warehouseId_key" ON "Caravan"("warehouseId");
CREATE INDEX "Caravan_empireId_idx" ON "Caravan"("empireId");
CREATE INDEX "Caravan_status_arrivesAt_idx" ON "Caravan"("status", "arrivesAt");

CREATE INDEX "MarketOrder_regionId_resourceType_status_idx" ON "MarketOrder"("regionId", "resourceType", "status");
CREATE INDEX "MarketOrder_empireId_idx" ON "MarketOrder"("empireId");

CREATE INDEX "MarketTrade_listingId_idx" ON "MarketTrade"("listingId");
CREATE INDEX "MarketTrade_buyerEmpireId_idx" ON "MarketTrade"("buyerEmpireId");
CREATE INDEX "MarketTrade_executedAt_idx" ON "MarketTrade"("executedAt");

CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

CREATE UNIQUE INDEX "GuildMember_playerId_key" ON "GuildMember"("playerId");
CREATE INDEX "GuildMember_guildId_idx" ON "GuildMember"("guildId");

CREATE UNIQUE INDEX "DistrictControl_districtId_weekNumber_key" ON "DistrictControl"("districtId", "weekNumber");
CREATE INDEX "DistrictControl_guildId_idx" ON "DistrictControl"("guildId");

CREATE INDEX "ChatMessage_channelType_channelId_sentAt_idx" ON "ChatMessage"("channelType", "channelId", "sentAt");

CREATE UNIQUE INDEX "GameTick_tickNumber_key" ON "GameTick"("tickNumber");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "District" ADD CONSTRAINT "District_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlotTrait" ADD CONSTRAINT "PlotTrait_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseItem" ADD CONSTRAINT "WarehouseItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Empire" ADD CONSTRAINT "Empire_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Keep" ADD CONSTRAINT "Keep_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Keep" ADD CONSTRAINT "Keep_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Keep" ADD CONSTRAINT "Keep_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Building" ADD CONSTRAINT "Building_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Caravan" ADD CONSTRAINT "Caravan_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Caravan" ADD CONSTRAINT "Caravan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_sellerEmpireId_fkey" FOREIGN KEY ("sellerEmpireId") REFERENCES "Empire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_buyerEmpireId_fkey" FOREIGN KEY ("buyerEmpireId") REFERENCES "Empire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Guild" ADD CONSTRAINT "Guild_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistrictControl" ADD CONSTRAINT "DistrictControl_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistrictControl" ADD CONSTRAINT "DistrictControl_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxCollection" ADD CONSTRAINT "TaxCollection_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxCollection" ADD CONSTRAINT "TaxCollection_tickId_fkey" FOREIGN KEY ("tickId") REFERENCES "GameTick"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
