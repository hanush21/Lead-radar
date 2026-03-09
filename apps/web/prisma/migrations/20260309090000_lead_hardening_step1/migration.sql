-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Lead"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'serpapi',
  ADD COLUMN "providerPlaceId" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "leadScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Lead_userId_dedupeKey_idx" ON "Lead"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Lead_userId_provider_providerPlaceId_idx" ON "Lead"("userId", "provider", "providerPlaceId");

-- CreateIndex
CREATE INDEX "Lead_userId_leadScore_idx" ON "Lead"("userId", "leadScore");
