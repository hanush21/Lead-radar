import type { ICampaignRepository } from "../../domain/repositories/ICampaignRepository";
import type { ILeadRepository } from "@/modules/leads/domain/repositories/ILeadRepository";
import { NotFoundError } from "@/shared/errors/AppError";

export interface IEmailProvider {
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ resendId: string }>;
}

export class SendCampaignUseCase {
  constructor(
    private readonly campaignRepository: ICampaignRepository,
    private readonly leadRepository: ILeadRepository,
    private readonly emailProvider: IEmailProvider
  ) {}

  async execute(campaignId: string, leadIds: string[], userId: string) {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign || campaign.userId !== userId) {
      throw new NotFoundError("Campaign", campaignId);
    }

    await this.campaignRepository.update(campaignId, { status: "SENDING" });

    const results: Array<{ leadId: string; success: boolean; error?: string }> = [];

    for (const leadId of leadIds) {
      const lead = await this.leadRepository.findById(leadId);
      if (!lead || lead.userId !== userId || !lead.email) {
        results.push({ leadId, success: false, error: "Lead not found or no email" });
        continue;
      }

      const emailJob = await this.campaignRepository.createEmailJob({
        leadId,
        campaignId,
      });

      try {
        const { resendId } = await this.emailProvider.sendEmail({
          to: lead.email,
          subject: campaign.subject,
          html: campaign.body,
        });

        await this.campaignRepository.updateEmailJob(emailJob.id, {
          status: "SENT",
          resendId,
          sentAt: new Date(),
        });

        results.push({ leadId, success: true });
      } catch (error) {
        await this.campaignRepository.updateEmailJob(emailJob.id, {
          status: "FAILED",
        });
        results.push({
          leadId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    await this.campaignRepository.update(campaignId, {
      status: "SENT",
      sentAt: new Date(),
    });

    return results;
  }
}
