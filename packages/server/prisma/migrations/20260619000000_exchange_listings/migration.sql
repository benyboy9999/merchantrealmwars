-- Drop the old order-book MarketTrade table (dev only — no real data)
DROP TABLE IF EXISTS "MarketTrade";

-- Recreate as a real-time purchase record
CREATE TABLE "MarketTrade" (
    "id"             TEXT NOT NULL,
    "listingId"      TEXT NOT NULL,
    "sellerEmpireId" TEXT,
    "buyerEmpireId"  TEXT NOT NULL,
    "resourceType"   TEXT NOT NULL,
    "quantity"       DOUBLE PRECISION NOT NULL,
    "pricePerUnit"   DOUBLE PRECISION NOT NULL,
    "totalGold"      DOUBLE PRECISION NOT NULL,
    "executedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTrade_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "MarketOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_sellerEmpireId_fkey"
    FOREIGN KEY ("sellerEmpireId") REFERENCES "Empire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketTrade" ADD CONSTRAINT "MarketTrade_buyerEmpireId_fkey"
    FOREIGN KEY ("buyerEmpireId") REFERENCES "Empire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "MarketTrade_listingId_idx" ON "MarketTrade"("listingId");
CREATE INDEX "MarketTrade_buyerEmpireId_idx" ON "MarketTrade"("buyerEmpireId");
CREATE INDEX "MarketTrade_executedAt_idx" ON "MarketTrade"("executedAt");
