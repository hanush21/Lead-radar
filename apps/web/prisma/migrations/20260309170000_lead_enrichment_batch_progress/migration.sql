ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "enrichmentBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "enrichmentRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enrichmentCompletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_userId_enrichmentBatchId_idx"
  ON "Lead"("userId", "enrichmentBatchId");
