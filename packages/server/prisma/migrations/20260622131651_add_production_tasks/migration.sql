-- AlterTable
ALTER TABLE "WarehouseItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "keepId" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completesAt" TIMESTAMP(3) NOT NULL,
    "progressAtUpdate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "speedSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionTask_buildingId_key" ON "ProductionTask"("buildingId");

-- CreateIndex
CREATE INDEX "ProductionTask_completesAt_idx" ON "ProductionTask"("completesAt");

-- CreateIndex
CREATE INDEX "ProductionTask_keepId_idx" ON "ProductionTask"("keepId");

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_keepId_fkey" FOREIGN KEY ("keepId") REFERENCES "Keep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
