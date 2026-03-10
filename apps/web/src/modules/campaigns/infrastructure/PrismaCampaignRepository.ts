import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import type { Campaign, CreateCampaignInput } from "../domain/entities/Campaign";
import type { CampaignTemplate } from "../domain/entities/CampaignTemplate";
import type { EmailEventType } from "../domain/entities/EmailEvent";
import type { EmailJob, EmailStatus } from "../domain/entities/EmailJob";
import type { ICampaignRepository } from "../domain/repositories/ICampaignRepository";
import { DEFAULT_CAMPAIGN_TEMPLATES } from "./templates/defaultTemplates";

const STATUS_PRIORITY: Record<EmailStatus, number> = {
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

const EVENT_TO_STATUS: Record<EmailEventType, EmailStatus> = {
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  OPENED: "OPENED",
  CLICKED: "CLICKED",
  BOUNCED: "BOUNCED",
  COMPLAINED: "COMPLAINED",
  UNSUBSCRIBED: "UNSUBSCRIBED",
};

function chooseStatus(current: EmailStatus, fromEvent: EmailStatus): EmailStatus {
  return STATUS_PRIORITY[fromEvent] >= STATUS_PRIORITY[current] ? fromEvent : current;
}

function mapCampaignTemplate(raw: any): CampaignTemplate {
  return raw as CampaignTemplate;
}

function mapEmailJob(raw: any): EmailJob {
  return raw as EmailJob;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export class PrismaCampaignRepository implements ICampaignRepository {
  async create(input: CreateCampaignInput): Promise<Campaign> {
    return prisma.campaign.create({ data: input }) as unknown as Campaign;
  }

  async findById(id: string): Promise<Campaign | null> {
    return prisma.campaign.findUnique({ where: { id } }) as unknown as Campaign | null;
  }

  async findAll(userId: string): Promise<Campaign[]> {
    return prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }) as unknown as Campaign[];
  }

  async update(id: string, data: Partial<Campaign>): Promise<Campaign> {
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    return prisma.campaign.update({ where: { id }, data: updateData }) as unknown as Campaign;
  }

  async createEmailJob(data: {
    leadId: string;
    campaignId: string;
    renderedSubject?: string | null;
    renderedHtml?: string | null;
    aiPersonalized?: boolean;
  }): Promise<EmailJob> {
    const created = await prisma.emailJob.create({
      data: {
        leadId: data.leadId,
        campaignId: data.campaignId,
        renderedSubject: data.renderedSubject ?? null,
        renderedHtml: data.renderedHtml ?? null,
        aiPersonalized: data.aiPersonalized ?? false,
      },
    });
    return mapEmailJob(created);
  }

  async updateEmailJob(id: string, data: Partial<EmailJob>): Promise<EmailJob> {
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.createdAt;
    const updated = await prisma.emailJob.update({ where: { id }, data: updateData });
    return mapEmailJob(updated);
  }

  async getEmailJobsByCampaign(campaignId: string): Promise<EmailJob[]> {
    const jobs = await prisma.emailJob.findMany({ where: { campaignId } });
    return jobs.map(mapEmailJob);
  }

  async getRecentEmailJobsToReconcile(limit = 200): Promise<EmailJob[]> {
    const jobs = await prisma.emailJob.findMany({
      where: {
        resendId: { not: null },
        status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return jobs.map(mapEmailJob);
  }

  async findEmailJobByResendId(resendId: string): Promise<EmailJob | null> {
    const job = await prisma.emailJob.findFirst({ where: { resendId } });
    return job ? mapEmailJob(job) : null;
  }

  async recordEmailEvent(input: {
    emailJobId: string;
    providerEventId: string;
    resendId: string | null;
    eventType: EmailEventType;
    occurredAt: Date;
    payload: unknown;
  }): Promise<{ created: boolean }> {
    return prisma.$transaction(async (tx) => {
      try {
        await tx.emailEvent.create({
          data: {
            emailJobId: input.emailJobId,
            provider: "resend",
            providerEventId: input.providerEventId,
            resendId: input.resendId,
            eventType: input.eventType,
            occurredAt: input.occurredAt,
            payload: input.payload as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) return { created: false };
        throw error;
      }

      const current = await tx.emailJob.findUnique({
        where: { id: input.emailJobId },
      });
      if (!current) return { created: true };

      const nextStatus = chooseStatus(
        current.status as EmailStatus,
        EVENT_TO_STATUS[input.eventType]
      );

      const patch: Prisma.EmailJobUpdateInput = {
        status: nextStatus,
        lastSyncedAt: new Date(),
      };

      if (input.eventType === "SENT" && !current.sentAt) patch.sentAt = input.occurredAt;
      if (input.eventType === "DELIVERED" && !current.deliveredAt) patch.deliveredAt = input.occurredAt;
      if (input.eventType === "OPENED" && !current.openedAt) patch.openedAt = input.occurredAt;
      if (input.eventType === "CLICKED" && !current.clickedAt) patch.clickedAt = input.occurredAt;
      if (input.eventType === "BOUNCED" && !current.bouncedAt) patch.bouncedAt = input.occurredAt;
      if (input.eventType === "COMPLAINED" && !current.complainedAt) patch.complainedAt = input.occurredAt;
      if (input.eventType === "UNSUBSCRIBED" && !current.unsubscribedAt) {
        patch.unsubscribedAt = input.occurredAt;
      }

      await tx.emailJob.update({
        where: { id: input.emailJobId },
        data: patch,
      });

      return { created: true };
    });
  }

  async listActiveTemplates(): Promise<CampaignTemplate[]> {
    const templates = await prisma.campaignTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    });
    return templates.map(mapCampaignTemplate);
  }

  async findTemplateById(id: string): Promise<CampaignTemplate | null> {
    const template = await prisma.campaignTemplate.findUnique({ where: { id } });
    return template ? mapCampaignTemplate(template) : null;
  }

  async findDefaultTemplateByCategory(category: string): Promise<CampaignTemplate | null> {
    const byCategory = await prisma.campaignTemplate.findFirst({
      where: { category, isDefault: true, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (byCategory) return mapCampaignTemplate(byCategory);

    const fallback = await prisma.campaignTemplate.findFirst({
      where: { category: "OTHER", isDefault: true, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    return fallback ? mapCampaignTemplate(fallback) : null;
  }

  async ensureDefaultTemplates(): Promise<void> {
    for (const template of DEFAULT_CAMPAIGN_TEMPLATES) {
      await prisma.campaignTemplate.upsert({
        where: { slug: template.slug },
        create: template,
        update: {
          name: template.name,
          category: template.category,
          isDefault: template.isDefault,
          isActive: template.isActive,
          subjectTemplate: template.subjectTemplate,
          headlineTemplate: template.headlineTemplate,
          introTemplate: template.introTemplate,
          bodyTemplate: template.bodyTemplate,
          ctaLabelTemplate: template.ctaLabelTemplate,
          ctaUrlTemplate: template.ctaUrlTemplate,
          signatureTemplate: template.signatureTemplate,
        },
      });
    }
  }

  async getCampaignStats(campaignId: string) {
    const jobs = await prisma.emailJob.findMany({ where: { campaignId } });

    const total = jobs.length;
    const sent = jobs.filter((j) => Boolean(j.sentAt)).length;
    const opened = jobs.filter((j) => j.status === "OPENED").length;
    const clicked = jobs.filter((j) => j.status === "CLICKED").length;
    const failed = jobs.filter((j) => j.status === "FAILED").length;
    const delivered = jobs.filter((j) => Boolean(j.deliveredAt)).length;
    const bounced = jobs.filter((j) => Boolean(j.bouncedAt) || j.status === "BOUNCED").length;
    const complained = jobs.filter((j) => Boolean(j.complainedAt) || j.status === "COMPLAINED").length;
    const unsubscribed = jobs.filter((j) => Boolean(j.unsubscribedAt) || j.status === "UNSUBSCRIBED").length;
    const openedUnique = jobs.filter((j) => Boolean(j.openedAt)).length;
    const clickedUnique = jobs.filter((j) => Boolean(j.clickedAt)).length;
    const converted = jobs.filter((j) => Boolean(j.convertedAt)).length;

    const openRate = delivered > 0 ? (openedUnique / delivered) * 100 : 0;
    const clickRate = delivered > 0 ? (clickedUnique / delivered) * 100 : 0;
    const ctor = openedUnique > 0 ? (clickedUnique / openedUnique) * 100 : 0;
    const conversionRate = delivered > 0 ? (converted / delivered) * 100 : 0;

    return {
      total,
      sent,
      opened,
      clicked,
      failed,
      delivered,
      bounced,
      complained,
      unsubscribed,
      openedUnique,
      clickedUnique,
      converted,
      openRate,
      clickRate,
      ctor,
      conversionRate,
    };
  }
}
