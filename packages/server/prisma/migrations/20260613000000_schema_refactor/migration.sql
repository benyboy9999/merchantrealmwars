-- Remove old region control system
DROP TABLE IF EXISTS "RegionControl";

-- Swap Region.bonusType for RegionBonus table
ALTER TABLE "Region" DROP COLUMN IF EXISTS "bonusType";
DROP TYPE IF EXISTS "RegionBonusType";
DROP TYPE IF EXISTS "RegionId";

-- RegionBonus: per-category bonus per region
CREATE TABLE "RegionBonus" (
    "id"        TEXT NOT NULL,
    "regionId"  TEXT NOT NULL,
    "category"  TEXT NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "RegionBonus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RegionBonus_regionId_category_key" ON "RegionBonus"("regionId", "category");
CREATE INDEX "RegionBonus_regionId_idx" ON "RegionBonus"("regionId");
ALTER TABLE "RegionBonus" ADD CONSTRAINT "RegionBonus_regionId_fkey"
    FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add tier columns to District and Plot
ALTER TABLE "District" ADD COLUMN IF NOT EXISTS "tier" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Plot"     ADD COLUMN IF NOT EXISTS "tier" INTEGER NOT NULL DEFAULT 1;

-- PlotTrait: per-trait data attached to a plot
CREATE TABLE "PlotTrait" (
    "id"        TEXT NOT NULL,
    "plotId"    TEXT NOT NULL,
    "traitType" TEXT NOT NULL,
    "baseValue" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "PlotTrait_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlotTrait_plotId_traitType_key" ON "PlotTrait"("plotId", "traitType");
CREATE INDEX "PlotTrait_plotId_idx" ON "PlotTrait"("plotId");
ALTER TABLE "PlotTrait" ADD CONSTRAINT "PlotTrait_plotId_fkey"
    FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DistrictControl: guild ownership of a district for a given week
CREATE TABLE "DistrictControl" (
    "id"           TEXT NOT NULL,
    "guildId"      TEXT NOT NULL,
    "districtId"   TEXT NOT NULL,
    "weekNumber"   INTEGER NOT NULL,
    "controlStart" TIMESTAMP(3) NOT NULL,
    "controlEnd"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DistrictControl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DistrictControl_districtId_weekNumber_key" ON "DistrictControl"("districtId", "weekNumber");
CREATE INDEX "DistrictControl_guildId_idx" ON "DistrictControl"("guildId");
ALTER TABLE "DistrictControl" ADD CONSTRAINT "DistrictControl_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistrictControl" ADD CONSTRAINT "DistrictControl_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
