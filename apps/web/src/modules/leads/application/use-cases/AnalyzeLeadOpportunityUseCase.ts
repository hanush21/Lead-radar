import type { ILeadRepository } from "../../domain/repositories/ILeadRepository";
import type { ILeadAnalyzer } from "./SearchLeadsUseCase";
import { NotFoundError } from "@/shared/errors/AppError";

export class AnalyzeLeadOpportunityUseCase {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly leadAnalyzer: ILeadAnalyzer
  ) {}

  async execute(leadId: string, userId: string) {
    const lead = await this.leadRepository.findById(leadId);
    if (!lead || lead.userId !== userId) {
      throw new NotFoundError("Lead", leadId);
    }

    const opportunities = this.leadAnalyzer.analyze({
      website: lead.website,
      hasBookingSystem: lead.hasBookingSystem,
      hasOnlinePayment: lead.hasOnlinePayment,
      category: lead.category,
    });

    const updated = await this.leadRepository.update(leadId, { opportunities });
    return updated;
  }
}
