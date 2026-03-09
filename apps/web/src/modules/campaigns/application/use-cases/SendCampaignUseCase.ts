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

export interface SendCampaignOptions {
  templateId?: string;
  useAiPersonalization?: boolean;
}

export interface ICampaignEmailComposer {
  compose(
    campaign: { name: string; subject: string; body: string },
    lead: {
      id: string;
      name: string;
      category: string;
      address: string;
      website: string | null;
      email: string | null;
      rating: number | null;
      reviewCount: number;
      hasBookingSystem: boolean;
      hasOnlinePayment: boolean;
      leadScore: number;
      segment: string;
    },
    options: SendCampaignOptions
  ): Promise<{ subject: string; html: string; aiPersonalized: boolean; templateId: string | null }>;
}

export class SendCampaignUseCase {
  constructor(
    private readonly campaignRepository: ICampaignRepository,
    private readonly leadRepository: ILeadRepository,
    private readonly emailProvider: IEmailProvider,
    private readonly emailComposer: ICampaignEmailComposer
  ) {}

  async execute(
    campaignId: string,
    leadIds: string[],
    userId: string,
    options: SendCampaignOptions = {}
  ) {
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

      const composed = await this.emailComposer.compose(campaign, lead, options);

      const emailJob = await this.campaignRepository.createEmailJob({
        leadId,
        campaignId,
        renderedSubject: composed.subject,
        renderedHtml: composed.html,
        aiPersonalized: composed.aiPersonalized,
      });

      try {
        const { resendId } = await this.emailProvider.sendEmail({
          to: lead.email,
          subject: composed.subject,
          html: composed.html,
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
