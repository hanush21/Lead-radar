import type { ICampaignRepository } from "../../domain/repositories/ICampaignRepository";

export class TrackEmailOpenUseCase {
  constructor(private readonly campaignRepository: ICampaignRepository) {}

  async execute(resendId: string, event: "opened" | "clicked") {
    const job = await this.campaignRepository.findEmailJobByResendId(resendId);
    if (!job) return;

    if (event === "opened") {
      await this.campaignRepository.updateEmailJob(job.id, {
        status: "OPENED",
        openedAt: new Date(),
      });
    } else if (event === "clicked") {
      await this.campaignRepository.updateEmailJob(job.id, {
        status: "CLICKED",
        clickedAt: new Date(),
      });
    }
  }
}
