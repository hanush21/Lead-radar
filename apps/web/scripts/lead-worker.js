const PgBoss = require("pg-boss");
const { PrismaClient } = require("@prisma/client");

const LEAD_POSTPROCESS_JOB = "lead.postprocess";
const LEAD_RECHECK_JOB = "lead.recheck";
const BOOKING_CATEGORIES = new Set([
  "BARBERSHOP",
  "HAIR_SALON",
  "RESTAURANT",
  "DENTAL_CLINIC",
  "MECHANIC",
  "VET",
  "BEAUTY_SALON",
]);

const prisma = new PrismaClient();
const onceMode = process.argv.includes("--once") || process.env.WORKER_ONCE === "true";
const concurrency = Number(process.env.WORKER_CONCURRENCY || "3");
let processedJobs = 0;
let shuttingDown = false;
let boss = null;

function calculateLeadScore(lead) {
  let score = 25;

  if (!lead.website) score += 30;
  if (!lead.email) score -= 5;

  if (lead.rating == null) score += 8;
  else if (lead.rating < 4) score += 16;
  else if (lead.rating < 4.5) score += 8;

  if (lead.reviewCount < 20) score += 12;
  else if (lead.reviewCount < 80) score += 6;

  if (BOOKING_CATEGORIES.has(String(lead.category || "")) && !lead.hasBookingSystem) score += 10;
  if (!lead.hasOnlinePayment) score += 8;

  return Math.max(0, Math.min(100, score));
}

function analyzeLeadOpportunities(lead) {
  const opportunities = [];

  if (!lead.website) {
    opportunities.push({
      type: "NO_WEBSITE",
      label: "Sin pagina web",
      description: "No tiene presencia web clara.",
      suggestedService: "Landing page / Web corporativa",
    });
  }

  if (BOOKING_CATEGORIES.has(String(lead.category || "")) && !lead.hasBookingSystem) {
    opportunities.push({
      type: "NO_BOOKING",
      label: "Sin sistema de citas",
      description: "No dispone de reservas online.",
      suggestedService: "Sistema de reservas",
    });
  }

  if (!lead.hasOnlinePayment) {
    opportunities.push({
      type: "NO_PAYMENT",
      label: "Sin pagos online",
      description: "No acepta pagos online visibles.",
      suggestedService: "Pasarela de pago",
    });
  }

  return opportunities;
}

async function processLead(leadId, userId, jobName, jobId) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    console.warn("[worker] lead not found", { leadId, userId, jobName, jobId });
    return;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { enrichmentStatus: "PROCESSING" },
  });

  const opportunities = analyzeLeadOpportunities(lead);
  const leadScore = calculateLeadScore(lead);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      opportunities,
      leadScore,
      enrichmentStatus: "DONE",
      lastSeenAt: new Date(),
    },
  });
}

async function handleJob(job, jobName) {
  const payload = job?.data || {};
  const leadId = payload.leadId;
  const userId = payload.userId;
  const jobId = job?.id;

  if (!leadId || !userId) {
    console.warn("[worker] invalid job payload", { jobId, jobName, payload });
    return;
  }

  console.info("[worker] processing", { jobId, jobName, leadId, userId });

  try {
    await processLead(leadId, userId, jobName, jobId);
    processedJobs += 1;
    console.info("[worker] done", { jobId, jobName, leadId, userId });

    if (onceMode && processedJobs >= 1) {
      setTimeout(() => shutdown(0), 50);
    }
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { enrichmentStatus: "FAILED" },
    }).catch(() => {});

    console.error("[worker] failed", { jobId, jobName, leadId, userId, error });
    throw error;
  }
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    if (boss) await boss.stop();
    await prisma.$disconnect();
  } catch (error) {
    console.error("[worker] shutdown error", error);
  } finally {
    process.exit(code);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  boss = new PgBoss(process.env.DATABASE_URL);
  await boss.start();
  await boss.createQueue(LEAD_POSTPROCESS_JOB);
  await boss.createQueue(LEAD_RECHECK_JOB);

  for (let i = 0; i < concurrency; i += 1) {
    await boss.work(LEAD_POSTPROCESS_JOB, (job) => handleJob(job, LEAD_POSTPROCESS_JOB));
    await boss.work(LEAD_RECHECK_JOB, (job) => handleJob(job, LEAD_RECHECK_JOB));
  }

  console.info("[worker] started", { concurrency, onceMode });

  if (onceMode) {
    setTimeout(() => shutdown(0), 20000);
  }
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error("[worker] startup failed", error);
  shutdown(1);
});

