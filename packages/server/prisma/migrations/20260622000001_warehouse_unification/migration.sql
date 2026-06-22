-- Warehouse Unification Migration
-- Replaces ResourceLedger, CaravanCargo, ExchangeStorage with a single
-- Warehouse + WarehouseItem model. Existing data is migrated inline.
-- Removes unused models: WorkerConsumptionLog, BuildingUpkeepLog,
-- RegionBonus, SpecialisationTree/Node, EmpireSpecialisation.

-- ── New enum ──────────────────────────────────────────────────────────────
CREATE TYPE "WarehouseType" AS ENUM ('KEEP', 'CARAVAN', 'EXCHANGE');

-- ── New tables ────────────────────────────────────────────────────────────
CREATE TABLE "Warehouse" (
    "id"       TEXT NOT NULL,
    "type"     "WarehouseType" NOT NULL,
    "empireId" TEXT NOT NULL,
    "regionId" TEXT,
    "cap"      DOUBLE PRECISION NOT NULL,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseItem" (
    "id"           TEXT NOT NULL,
    "warehouseId"  TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarehouseItem_pkey" PRIMARY KEY ("id")
);

-- ── Add nullable warehouseId columns ─────────────────────────────────────
ALTER TABLE "Keep"    ADD COLUMN "warehouseId" TEXT;
ALTER TABLE "Caravan" ADD COLUMN "warehouseId" TEXT;

-- ── Data migration: keeps ─────────────────────────────────────────────────
-- For each Keep: create a Warehouse, migrate ResourceLedger rows, link back.

CREATE TEMP TABLE _keep_wh AS
SELECT
    k."id"       AS keep_id,
    gen_random_uuid()::text AS wh_id,
    k."empireId",
    10000.0 + COALESCE((
        SELECT SUM(b."level" * 2500.0)
        FROM   "Building" b
        WHERE  b."keepId" = k."id" AND b."buildingType" = 'WAREHOUSE'
    ), 0) AS cap
FROM "Keep" k;

INSERT INTO "Warehouse" ("id", "type", "empireId", "regionId", "cap")
SELECT wh_id, 'KEEP'::"WarehouseType", "empireId", NULL, cap
FROM _keep_wh;

-- Migrate resource ledger rows (no-op if ResourceLedger is empty)
INSERT INTO "WarehouseItem" ("id", "warehouseId", "resourceType", "quantity", "updatedAt")
SELECT gen_random_uuid()::text, m.wh_id, rl."resourceType", rl."quantity", rl."updatedAt"
FROM   "ResourceLedger" rl
JOIN   _keep_wh m ON rl."keepId" = m.keep_id;

UPDATE "Keep" SET "warehouseId" = m.wh_id
FROM _keep_wh m WHERE "Keep"."id" = m.keep_id;

-- ── Data migration: caravans ──────────────────────────────────────────────
CREATE TEMP TABLE _caravan_wh AS
SELECT
    c."id"       AS caravan_id,
    gen_random_uuid()::text AS wh_id,
    c."empireId",
    c."animalCount" * 100.0 AS cap  -- MULE_CAPACITY_KG = 100
FROM "Caravan" c;

INSERT INTO "Warehouse" ("id", "type", "empireId", "regionId", "cap")
SELECT wh_id, 'CARAVAN'::"WarehouseType", "empireId", NULL, cap
FROM _caravan_wh;

-- Migrate cargo rows (no-op if CaravanCargo is empty)
INSERT INTO "WarehouseItem" ("id", "warehouseId", "resourceType", "quantity", "updatedAt")
SELECT gen_random_uuid()::text, m.wh_id, cc."resourceType", cc."quantity", CURRENT_TIMESTAMP
FROM   "CaravanCargo" cc
JOIN   _caravan_wh m ON cc."caravanId" = m.caravan_id;

UPDATE "Caravan" SET "warehouseId" = m.wh_id
FROM _caravan_wh m WHERE "Caravan"."id" = m.caravan_id;

-- ── Data migration: exchange storage ─────────────────────────────────────
CREATE TEMP TABLE _exchange_wh AS
SELECT
    es."empireId",
    es."regionId",
    gen_random_uuid()::text AS wh_id
FROM (SELECT DISTINCT "empireId", "regionId" FROM "ExchangeStorage") es;

INSERT INTO "Warehouse" ("id", "type", "empireId", "regionId", "cap")
SELECT wh_id, 'EXCHANGE'::"WarehouseType", "empireId", "regionId", 1000000000.0
FROM _exchange_wh;

INSERT INTO "WarehouseItem" ("id", "warehouseId", "resourceType", "quantity", "updatedAt")
SELECT gen_random_uuid()::text, m.wh_id, es."resourceType", es."quantity", CURRENT_TIMESTAMP
FROM   "ExchangeStorage" es
JOIN   _exchange_wh m ON es."empireId" = m."empireId" AND es."regionId" = m."regionId";

-- ── Add FK constraints and indexes ───────────────────────────────────────
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_empireId_fkey"
    FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehouseItem" ADD CONSTRAINT "WarehouseItem_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WarehouseItem_warehouseId_resourceType_key" ON "WarehouseItem"("warehouseId", "resourceType");
CREATE        INDEX "WarehouseItem_warehouseId_idx"               ON "WarehouseItem"("warehouseId");
CREATE        INDEX "Warehouse_empireId_idx"                      ON "Warehouse"("empireId");
CREATE        INDEX "Warehouse_empireId_regionId_idx"             ON "Warehouse"("empireId", "regionId");

ALTER TABLE "Keep" ADD CONSTRAINT "Keep_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Keep_warehouseId_key" ON "Keep"("warehouseId");

ALTER TABLE "Caravan" ADD CONSTRAINT "Caravan_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Caravan_warehouseId_key" ON "Caravan"("warehouseId");

-- ── Drop old storage tables (data is now in WarehouseItem) ────────────────
DROP TABLE "ResourceLedger";
DROP TABLE "CaravanCargo";
DROP TABLE "ExchangeStorage";

-- ── Drop unused tables ────────────────────────────────────────────────────
DROP TABLE IF EXISTS "WorkerConsumptionLog";
DROP TABLE IF EXISTS "BuildingUpkeepLog";
DROP TABLE IF EXISTS "EmpireSpecialisation";
DROP TABLE IF EXISTS "SpecialisationNode";
DROP TABLE IF EXISTS "SpecialisationTree";
DROP TABLE IF EXISTS "RegionBonus";
