import { prisma } from "@/shared/lib/prisma";
import type { Campaign, CreateCampaignInput } from "../domain/entities/Campaign";
import type { EmailJob } from "../domain/entities/EmailJob";
import type { ICampaignRepository } from "../domain/repositories/ICampaignRepository";

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

  async createEmailJob(data: { leadId: string; campaignId: string }): Promise<EmailJob> {
    return prisma.emailJob.create({ data }) as unknown as EmailJob;
  }

  async updateEmailJob(id: string, data: Partial<EmailJob>): Promise<EmailJob> {
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.createdAt;
    return prisma.emailJob.update({ where: { id }, data: updateData }) as unknown as EmailJob;
  }

  async getEmailJobsByCampaign(campaignId: string): Promise<EmailJob[]> {
    return prisma.emailJob.findMany({
      where: { campaignId },
    }) as unknown as EmailJob[];
  }

  async getCampaignStats(campaignId: string) {
    const jobs = await prisma.emailJob.findMany({ where: { campaignId } });
    return {
      total: jobs.length,
      sent: jobs.filter((j: { status: string }) => j.status === "SENT").length,
      opened: jobs.filter((j: { status: string }) => j.status === "OPENED").length,
      clicked: jobs.filter((j: { status: string }) => j.status === "CLICKED").length,
      failed: jobs.filter((j: { status: string }) => j.status === "FAILED").length,
    };
  }
}
