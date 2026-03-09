-- Ensure dedupeKey is required after backfill
ALTER TABLE "Lead"
  ALTER COLUMN "dedupeKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_userId_dedupeKey_key" ON "Lead"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_userId_provider_providerPlaceId_key" ON "Lead"("userId", "provider", "providerPlaceId");
