CREATE TABLE "Wishlist" (
    "id" SERIAL NOT NULL,
    "empireId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WishlistItem" (
    "id" SERIAL NOT NULL,
    "wishlistId" INTEGER NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Wishlist_empireId_idx" ON "Wishlist"("empireId");

CREATE UNIQUE INDEX "WishlistItem_wishlistId_resourceType_key" ON "WishlistItem"("wishlistId", "resourceType");

CREATE INDEX "WishlistItem_wishlistId_idx" ON "WishlistItem"("wishlistId");

ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
