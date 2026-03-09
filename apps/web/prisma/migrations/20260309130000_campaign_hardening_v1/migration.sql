DO $$
BEGIN
  CREATE TYPE "LeadSegment" AS ENUM ('HOT', 'WARM', 'COLD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "EmailEventType" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'COMPLAINED';
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'UNSUBSCRIBED';

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "segment" "LeadSegment" NOT NULL DEFAULT 'WARM',
  ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "Lead_userId_segment_idx" ON "Lead"("userId", "segment");

ALTER TABLE "EmailJob"
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bouncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "complainedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "conversionSource" TEXT,
  ADD COLUMN IF NOT EXISTS "renderedSubject" TEXT,
  ADD COLUMN IF NOT EXISTS "renderedHtml" TEXT,
  ADD COLUMN IF NOT EXISTS "aiPersonalized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "EmailJob_resendId_idx" ON "EmailJob"("resendId");
CREATE INDEX IF NOT EXISTS "EmailJob_convertedAt_idx" ON "EmailJob"("convertedAt");

CREATE TABLE IF NOT EXISTS "CampaignTemplate" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "subjectTemplate" TEXT NOT NULL,
  "headlineTemplate" TEXT NOT NULL,
  "introTemplate" TEXT NOT NULL,
  "bodyTemplate" TEXT NOT NULL,
  "ctaLabelTemplate" TEXT NOT NULL,
  "ctaUrlTemplate" TEXT NOT NULL,
  "signatureTemplate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignTemplate_slug_key" ON "CampaignTemplate"("slug");
CREATE INDEX IF NOT EXISTS "CampaignTemplate_category_isDefault_idx" ON "CampaignTemplate"("category", "isDefault");
CREATE INDEX IF NOT EXISTS "CampaignTemplate_isActive_idx" ON "CampaignTemplate"("isActive");

CREATE TABLE IF NOT EXISTS "EmailEvent" (
  "id" TEXT NOT NULL,
  "emailJobId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'resend',
  "providerEventId" TEXT NOT NULL,
  "resendId" TEXT,
  "eventType" "EmailEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailEvent_providerEventId_key" ON "EmailEvent"("providerEventId");
CREATE INDEX IF NOT EXISTS "EmailEvent_emailJobId_idx" ON "EmailEvent"("emailJobId");
CREATE INDEX IF NOT EXISTS "EmailEvent_eventType_idx" ON "EmailEvent"("eventType");
CREATE INDEX IF NOT EXISTS "EmailEvent_resendId_idx" ON "EmailEvent"("resendId");

DO $$
BEGIN
  ALTER TABLE "EmailEvent"
    ADD CONSTRAINT "EmailEvent_emailJobId_fkey"
    FOREIGN KEY ("emailJobId") REFERENCES "EmailJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
