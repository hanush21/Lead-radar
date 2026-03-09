import type { Campaign, CreateCampaignInput } from "../entities/Campaign";
import type { CampaignTemplate } from "../entities/CampaignTemplate";
import type { EmailEventType } from "../entities/EmailEvent";
import type { EmailJob } from "../entities/EmailJob";

export interface ICampaignRepository {
  create(input: CreateCampaignInput): Promise<Campaign>;
  findById(id: string): Promise<Campaign | null>;
  findAll(userId: string): Promise<Campaign[]>;
  update(id: string, data: Partial<Campaign>): Promise<Campaign>;
  createEmailJob(data: {
    leadId: string;
    campaignId: string;
    renderedSubject?: string | null;
    renderedHtml?: string | null;
    aiPersonalized?: boolean;
  }): Promise<EmailJob>;
  updateEmailJob(id: string, data: Partial<EmailJob>): Promise<EmailJob>;
  getEmailJobsByCampaign(campaignId: string): Promise<EmailJob[]>;
  getRecentEmailJobsToReconcile(limit?: number): Promise<EmailJob[]>;
  findEmailJobByResendId(resendId: string): Promise<EmailJob | null>;
  recordEmailEvent(input: {
    emailJobId: string;
    providerEventId: string;
    resendId: string | null;
    eventType: EmailEventType;
    occurredAt: Date;
    payload: unknown;
  }): Promise<{ created: boolean }>;
  listActiveTemplates(): Promise<CampaignTemplate[]>;
  findTemplateById(id: string): Promise<CampaignTemplate | null>;
  findDefaultTemplateByCategory(category: string): Promise<CampaignTemplate | null>;
  ensureDefaultTemplates(): Promise<void>;
  getCampaignStats(campaignId: string): Promise<{
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    failed: number;
    delivered: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    openedUnique: number;
    clickedUnique: number;
    converted: number;
    openRate: number;
    clickRate: number;
    ctor: number;
    conversionRate: number;
  }>;
}
