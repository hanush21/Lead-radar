import type { Campaign, CreateCampaignInput } from "../entities/Campaign";
import type { EmailJob } from "../entities/EmailJob";

export interface ICampaignRepository {
  create(input: CreateCampaignInput): Promise<Campaign>;
  findById(id: string): Promise<Campaign | null>;
  findAll(userId: string): Promise<Campaign[]>;
  update(id: string, data: Partial<Campaign>): Promise<Campaign>;
  createEmailJob(data: { leadId: string; campaignId: string }): Promise<EmailJob>;
  updateEmailJob(id: string, data: Partial<EmailJob>): Promise<EmailJob>;
  getEmailJobsByCampaign(campaignId: string): Promise<EmailJob[]>;
  getCampaignStats(campaignId: string): Promise<{
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    failed: number;
  }>;
}
