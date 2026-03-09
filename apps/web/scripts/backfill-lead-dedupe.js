const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeWebsite(url) {
  const raw = normalize(url);
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function toDedupeKey(lead) {
  const provider = normalize(lead.provider) || "serpapi";
  const providerPlaceId = normalize(lead.providerPlaceId);
  const website = normalizeWebsite(lead.website);
  const name = normalize(lead.name);
  const address = normalize(lead.address);
  const lat = Number(lead.lat || 0).toFixed(4);
  const lng = Number(lead.lng || 0).toFixed(4);

  const identity = providerPlaceId
    ? `provider:${provider}|place:${providerPlaceId}`
    : website
      ? `provider:${provider}|website:${website}`
      : `provider:${provider}|name:${name}|address:${address}|lat:${lat}|lng:${lng}`;

  return `v1:${crypto.createHash("sha256").update(identity).digest("hex")}`;
}

async function main() {
  const leads = await prisma.$queryRawUnsafe(`
    SELECT "id", "userId", "name", "address", "lat", "lng", "website", "provider", "providerPlaceId", "updatedAt"
    FROM "Lead"
    ORDER BY "userId" ASC, "updatedAt" DESC
  `);

  const keepByKey = new Map();
  let updated = 0;
  let merged = 0;

  for (const lead of leads) {
    const provider = normalize(lead.provider) || "serpapi";
    const dedupeKey = toDedupeKey(lead);
    const userDedupeKey = `${lead.userId}::${dedupeKey}`;

    const existingKeepId = keepByKey.get(userDedupeKey);
    if (!existingKeepId) {
      keepByKey.set(userDedupeKey, lead.id);
      await prisma.$executeRaw`
        UPDATE "Lead"
        SET "provider" = ${provider},
            "dedupeKey" = ${dedupeKey},
            "lastSeenAt" = COALESCE("lastSeenAt", "updatedAt")
        WHERE "id" = ${lead.id}
      `;
      updated++;
      continue;
    }

    if (existingKeepId === lead.id) continue;

    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "EmailJob"
        SET "leadId" = ${existingKeepId}
        WHERE "leadId" = ${lead.id}
      `,
      prisma.$executeRaw`
        DELETE FROM "Lead"
        WHERE "id" = ${lead.id}
      `,
    ]);

    merged++;
  }

  const missing = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "count"
    FROM "Lead"
    WHERE "dedupeKey" IS NULL
  `);

  console.log("Backfill completed", {
    total: leads.length,
    updated,
    merged,
    missingDedupeKeys: missing?.[0]?.count ?? 0,
  });
}

main()
  .catch((error) => {
    console.error("Backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
