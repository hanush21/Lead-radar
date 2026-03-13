const { loadEnvConfig } = require("@next/env");
const PgBoss = require("pg-boss");
const { PrismaClient } = require("@prisma/client");
const { Resend } = require("resend");

loadEnvConfig(process.cwd());

const LEAD_POSTPROCESS_JOB = "lead.postprocess";
const LEAD_RECHECK_JOB = "lead.recheck";
const CAMPAIGN_RECONCILE_EMAIL_EVENTS_JOB = "campaign.reconcile-email-events";
const CAMPAIGN_RECONCILE_CONVERSIONS_JOB = "campaign.reconcile-conversions";
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const CONTACT_PATH_HINTS = [
  "/contact",
  "/contacto",
  "/sobre-nosotros",
  "/about",
  "/about-us",
  "/aviso-legal",
  "/legal",
  "/privacy",
  "/terms",
];
const CONTACT_LINK_KEYWORDS = ["contact", "contacto", "about", "legal", "aviso", "privacy", "terms", "team"];
const EMAIL_REJECT_PREFIXES = ["noreply@", "no-reply@", "donotreply@", "do-not-reply@"];
const FETCH_TIMEOUT_MS = Number(process.env.WORKER_FETCH_TIMEOUT_MS || "5000");
const MAX_FETCH_BODY_CHARS = 150000;
const MAX_CONTACT_LINKS = 6;

const BOOKING_CATEGORIES = new Set([
  "BARBERSHOP",
  "HAIR_SALON",
  "RESTAURANT",
  "DENTAL_CLINIC",
  "MECHANIC",
  "VET",
  "BEAUTY_SALON",
]);

const EVENT_TO_STATUS = {
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  OPENED: "OPENED",
  CLICKED: "CLICKED",
  BOUNCED: "BOUNCED",
  COMPLAINED: "COMPLAINED",
  UNSUBSCRIBED: "UNSUBSCRIBED",
};

const STATUS_PRIORITY = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  CLICKED: 4,
  BOUNCED: 5,
  COMPLAINED: 6,
  UNSUBSCRIBED: 7,
  FAILED: 8,
};

const prisma = new PrismaClient();
const onceMode = process.argv.includes("--once") || process.env.WORKER_ONCE === "true";
const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || "1"));
const bossMaxConnections = Math.max(1, Number(process.env.WORKER_PGBOSS_MAX_CONNECTIONS || "2"));
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

let processedJobs = 0;
let shuttingDown = false;
let boss = null;

function getSafeDbTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    return {
      protocol: url.protocol.replace(":", ""),
      host: url.hostname || "(unknown)",
      port: url.port || "(default)",
      database: (url.pathname || "/").replace(/^\//, "") || "(default)",
      user: decodeURIComponent(url.username || "") || "(empty)",
    };
  } catch {
    return { invalid: true };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWebsite(rawWebsite) {
  const raw = String(rawWebsite || "").trim();
  if (!raw) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyValidEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return false;
  if (EMAIL_REJECT_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;
  if (value.endsWith(".png") || value.endsWith(".jpg") || value.endsWith(".jpeg") || value.endsWith(".svg")) {
    return false;
  }
  return true;
}

function uniqueEmailsFromText(input) {
  const text = String(input || "").toLowerCase();
  const all = text.match(EMAIL_RE) || [];
  const clean = new Set();
  for (const email of all) {
    const candidate = email.replace(/[),.;:!?]+$/, "");
    if (isLikelyValidEmail(candidate)) clean.add(candidate);
  }
  return [...clean];
}

function getSameOriginContactLinks(html, baseUrl) {
  const links = new Set();
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let match = hrefRe.exec(html);

  while (match) {
    const href = match[1];
    try {
      const url = new URL(href, baseUrl);
      if (url.origin !== new URL(baseUrl).origin) {
        match = hrefRe.exec(html);
        continue;
      }
      const path = `${url.pathname}${url.search}`.toLowerCase();
      if (CONTACT_LINK_KEYWORDS.some((keyword) => path.includes(keyword))) {
        links.add(`${url.origin}${url.pathname}${url.search}`);
      }
    } catch {}
    match = hrefRe.exec(html);
  }

  return [...links].slice(0, MAX_CONTACT_LINKS);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "LeadRadarBot/1.0 (+https://lead-radar.local)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return null;
    const text = await response.text();
    return text.slice(0, MAX_FETCH_BODY_CHARS);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function selectBestEmail(emails, website) {
  if (!emails.length) return null;
  const base = normalizeWebsite(website);
  const domain = base ? new URL(base).hostname.replace(/^www\./i, "") : "";

  const score = (email) => {
    let points = 0;
    const lower = email.toLowerCase();
    const emailDomain = lower.split("@")[1] || "";

    if (domain && (emailDomain === domain || emailDomain.endsWith(`.${domain}`))) points += 4;
    if (lower.startsWith("info@") || lower.startsWith("hola@") || lower.startsWith("contacto@")) points += 2;
    if (lower.startsWith("admin@") || lower.startsWith("webmaster@")) points -= 1;
    return points;
  };

  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

async function discoverEmailFromWebsite(website) {
  const normalized = normalizeWebsite(website);
  if (!normalized) return null;

  const visited = new Set();
  const candidates = [];
  const queue = [normalized];

  for (const path of CONTACT_PATH_HINTS) {
    queue.push(`${normalized}${path}`);
  }

  while (queue.length > 0 && visited.size < 8) {
    const target = queue.shift();
    if (!target || visited.has(target)) continue;
    visited.add(target);

    const html = await fetchHtml(target);
    if (!html) {
      await sleep(120);
      continue;
    }

    const directEmails = uniqueEmailsFromText(html);
    for (const email of directEmails) candidates.push(email);

    const textEmails = uniqueEmailsFromText(stripHtml(html));
    for (const email of textEmails) candidates.push(email);

    if (candidates.length > 0) break;

    const links = getSameOriginContactLinks(html, target);
    for (const link of links) {
      if (!visited.has(link)) queue.push(link);
    }

    await sleep(120);
  }

  const unique = [...new Set(candidates)];
  return selectBestEmail(unique, normalized);
}

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

function deriveLeadSegment(score) {
  if (score >= 70) return "HOT";
  if (score >= 45) return "WARM";
  return "COLD";
}

function deriveLeadTags(lead, opportunities) {
  const tags = new Set();
  if (!lead.website) tags.add("NO_WEBSITE");
  if (!lead.hasBookingSystem) tags.add("NO_BOOKING");
  if (!lead.hasOnlinePayment) tags.add("NO_PAYMENT");
  if (lead.rating != null && lead.rating < 4) tags.add("LOW_REVIEWS");
  if (lead.reviewCount < 20) tags.add("LOW_SOCIAL_PROOF");
  for (const opportunity of opportunities) {
    if (typeof opportunity?.type === "string" && opportunity.type.length > 0) tags.add(opportunity.type);
  }
  return [...tags];
}

async function processLead(leadId, userId, jobName, jobId, batchId) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    console.warn("[worker] lead not found", { leadId, userId, jobName, jobId, batchId });
    return;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { enrichmentStatus: "PROCESSING" },
  });

  let discoveredEmail = null;
  if (!lead.email && lead.website) {
    discoveredEmail = await discoverEmailFromWebsite(lead.website);
    if (discoveredEmail) {
      console.info("[worker] email discovered", { jobId, leadId, userId, discoveredEmail });
    }
  }

  const leadForAnalysis = {
    ...lead,
    email: discoveredEmail || lead.email,
  };

  const opportunities = analyzeLeadOpportunities(leadForAnalysis);
  const leadScore = calculateLeadScore(leadForAnalysis);
  const segment = deriveLeadSegment(leadScore);
  const tags = deriveLeadTags(leadForAnalysis, opportunities);
  if (discoveredEmail) tags.push("EMAIL_DISCOVERED");
  const uniqueTags = [...new Set(tags)];

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(discoveredEmail ? { email: discoveredEmail } : {}),
      opportunities,
      leadScore,
      segment,
      tags: uniqueTags,
      enrichmentStatus: "DONE",
      enrichmentCompletedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });
}

function mapReconciledEvent(lastEvent) {
  const normalized = String(lastEvent || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("unsubscribe")) return "UNSUBSCRIBED";
  if (normalized.includes("complain")) return "COMPLAINED";
  if (normalized.includes("bounce")) return "BOUNCED";
  if (normalized.includes("click")) return "CLICKED";
  if (normalized.includes("open")) return "OPENED";
  if (normalized.includes("deliver")) return "DELIVERED";
  if (normalized.includes("send")) return "SENT";
  return null;
}

async function applyEmailEvent({ emailJobId, providerEventId, resendId, eventType, occurredAt, payload }) {
  await prisma.$transaction(async (tx) => {
    try {
      await tx.emailEvent.create({
        data: {
          emailJobId,
          provider: "resend",
          providerEventId,
          resendId,
          eventType,
          occurredAt,
          payload,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") return;
      throw error;
    }

    const current = await tx.emailJob.findUnique({ where: { id: emailJobId } });
    if (!current) return;

    const eventStatus = EVENT_TO_STATUS[eventType];
    const nextStatus =
      STATUS_PRIORITY[eventStatus] >= STATUS_PRIORITY[current.status] ? eventStatus : current.status;

    const patch = {
      status: nextStatus,
      lastSyncedAt: new Date(),
    };

    if (eventType === "SENT" && !current.sentAt) patch.sentAt = occurredAt;
    if (eventType === "DELIVERED" && !current.deliveredAt) patch.deliveredAt = occurredAt;
    if (eventType === "OPENED" && !current.openedAt) patch.openedAt = occurredAt;
    if (eventType === "CLICKED" && !current.clickedAt) patch.clickedAt = occurredAt;
    if (eventType === "BOUNCED" && !current.bouncedAt) patch.bouncedAt = occurredAt;
    if (eventType === "COMPLAINED" && !current.complainedAt) patch.complainedAt = occurredAt;
    if (eventType === "UNSUBSCRIBED" && !current.unsubscribedAt) patch.unsubscribedAt = occurredAt;

    await tx.emailJob.update({
      where: { id: emailJobId },
      data: patch,
    });
  });
}

async function reconcileEmailEvents(jobId) {
  if (!resendClient) {
    console.warn("[worker] reconcile skipped, RESEND_API_KEY missing", { jobId });
    return { scanned: 0, updated: 0 };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const jobs = await prisma.emailJob.findMany({
    where: {
      resendId: { not: null },
      sentAt: { not: null, gte: thirtyDaysAgo },
      status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] },
    },
    orderBy: { sentAt: "desc" },
    take: 300,
  });

  let updated = 0;

  for (const emailJob of jobs) {
    if (!emailJob.resendId) continue;
    try {
      const result = await resendClient.emails.get(emailJob.resendId);
      const payload = result?.data;
      const mapped = mapReconciledEvent(payload?.last_event);
      if (!mapped) continue;

      const providerEventId = `${emailJob.resendId}:reconcile:${mapped}`;
      await applyEmailEvent({
        emailJobId: emailJob.id,
        providerEventId,
        resendId: emailJob.resendId,
        eventType: mapped,
        occurredAt: new Date(payload?.last_event_at || payload?.created_at || Date.now()),
        payload: payload || { source: "reconcile" },
      });
      updated += 1;
    } catch (error) {
      console.error("[worker] reconcile email failed", {
        jobId,
        emailJobId: emailJob.id,
        resendId: emailJob.resendId,
        error,
      });
    }
  }

  return { scanned: jobs.length, updated };
}

async function reconcileConversions(jobId) {
  const convertedLeads = await prisma.lead.findMany({
    where: { status: "CONVERTED" },
    select: { id: true, updatedAt: true },
    take: 500,
  });

  let attributed = 0;

  for (const lead of convertedLeads) {
    const hasAttribution = await prisma.emailJob.findFirst({
      where: { leadId: lead.id, convertedAt: { not: null } },
      select: { id: true },
    });
    if (hasAttribution) continue;

    const convertedAt = lead.updatedAt;
    const lowerBound = new Date(convertedAt.getTime() - 30 * 24 * 60 * 60 * 1000);

    const candidate = await prisma.emailJob.findFirst({
      where: {
        leadId: lead.id,
        sentAt: { not: null, lte: convertedAt, gte: lowerBound },
      },
      orderBy: { sentAt: "asc" },
    });

    if (!candidate) continue;

    await prisma.emailJob.update({
      where: { id: candidate.id },
      data: {
        convertedAt,
        conversionSource: "LEAD_STATUS",
        lastSyncedAt: new Date(),
      },
    });
    attributed += 1;
  }

  console.info("[worker] conversion reconciliation", {
    jobId,
    leadsScanned: convertedLeads.length,
    attributed,
  });

  return { leadsScanned: convertedLeads.length, attributed };
}

async function handleLeadJob(jobOrJobs, jobName) {
  const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];

  for (const job of jobs) {
    const payload = job?.data || {};
    const leadId = payload.leadId;
    const userId = payload.userId;
    const batchId = payload.batchId;
    const jobId = job?.id;

    if (!leadId || !userId) {
      console.warn("[worker] invalid lead payload", { jobId, jobName, payload });
      continue;
    }

    console.info("[worker] processing lead", { jobId, jobName, leadId, userId, batchId });

    try {
      await processLead(leadId, userId, jobName, jobId, batchId);
      processedJobs += 1;
      console.info("[worker] lead done", { jobId, jobName, leadId, userId, batchId });

      if (onceMode && processedJobs >= 1) {
        setTimeout(() => shutdown(0), 50);
      }
    } catch (error) {
      await prisma.lead
        .update({
          where: { id: leadId },
          data: { enrichmentStatus: "FAILED", enrichmentCompletedAt: new Date() },
        })
        .catch(() => {});

      console.error("[worker] lead failed", { jobId, jobName, leadId, userId, batchId, error });
      throw error;
    }
  }
}

async function handleCampaignReconcileJob(jobOrJobs, jobName) {
  const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];

  for (const job of jobs) {
    const jobId = job?.id;
    console.info("[worker] processing campaign reconcile", { jobId, jobName });

    try {
      if (jobName === CAMPAIGN_RECONCILE_EMAIL_EVENTS_JOB) {
        const result = await reconcileEmailEvents(jobId);
        console.info("[worker] campaign reconcile email done", { jobId, ...result });
      } else if (jobName === CAMPAIGN_RECONCILE_CONVERSIONS_JOB) {
        const result = await reconcileConversions(jobId);
        console.info("[worker] campaign reconcile conversion done", { jobId, ...result });
      }

      processedJobs += 1;
      if (onceMode && processedJobs >= 1) {
        setTimeout(() => shutdown(0), 50);
      }
    } catch (error) {
      console.error("[worker] campaign reconcile failed", { jobId, jobName, error });
      throw error;
    }
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

async function ensureSchedules() {
  try {
    await boss.schedule(CAMPAIGN_RECONCILE_EMAIL_EVENTS_JOB, "0 */6 * * *");
    await boss.schedule(CAMPAIGN_RECONCILE_CONVERSIONS_JOB, "10 */6 * * *");
  } catch (error) {
    console.error("[worker] failed to schedule recurring jobs", error);
  }
}

async function main() {
  const databaseUrl = process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or WORKER_DATABASE_URL is required");
  }
  const dbTarget = getSafeDbTarget(databaseUrl);

  boss = new PgBoss({
    connectionString: databaseUrl,
    max: bossMaxConnections,
    application_name: "leadradar-worker",
  });
  boss.on("error", (error) => {
    console.error("[worker] pg-boss error", error);
  });
  try {
    await boss.start();
  } catch (error) {
    if (error && error.code === "28P01") {
      console.error("[worker] database authentication failed", {
        code: error.code,
        dbTarget,
        usingWorkerDatabaseUrl: Boolean(process.env.WORKER_DATABASE_URL),
      });
      console.error(
        "[worker] hint: verify credentials in Render env vars (no quotes, URL-encoded password if it has special characters)."
      );
    }
    throw error;
  }
  await boss.createQueue(LEAD_POSTPROCESS_JOB);
  await boss.createQueue(LEAD_RECHECK_JOB);
  await boss.createQueue(CAMPAIGN_RECONCILE_EMAIL_EVENTS_JOB);
  await boss.createQueue(CAMPAIGN_RECONCILE_CONVERSIONS_JOB);
  await ensureSchedules();

  for (let i = 0; i < concurrency; i += 1) {
    await boss.work(LEAD_POSTPROCESS_JOB, (job) => handleLeadJob(job, LEAD_POSTPROCESS_JOB));
    await boss.work(LEAD_RECHECK_JOB, (job) => handleLeadJob(job, LEAD_RECHECK_JOB));
    await boss.work(CAMPAIGN_RECONCILE_EMAIL_EVENTS_JOB, (job) =>
      handleCampaignReconcileJob(job, CAMPAIGN_RECONCILE_EMAIL_EVENTS_JOB)
    );
    await boss.work(CAMPAIGN_RECONCILE_CONVERSIONS_JOB, (job) =>
      handleCampaignReconcileJob(job, CAMPAIGN_RECONCILE_CONVERSIONS_JOB)
    );
  }

  console.info("[worker] started", { concurrency, onceMode, bossMaxConnections });

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
