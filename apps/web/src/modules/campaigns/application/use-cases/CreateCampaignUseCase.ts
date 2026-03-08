import { z } from "zod";
import type { ICampaignRepository } from "../../domain/repositories/ICampaignRepository";

export const CreateCampaignDtoSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
});

export type CreateCampaignDto = z.infer<typeof CreateCampaignDtoSchema>;

export class CreateCampaignUseCase {
  constructor(private readonly campaignRepository: ICampaignRepository) {}

  async execute(dto: CreateCampaignDto, userId: string) {
    return this.campaignRepository.create({
      name: dto.name,
      subject: dto.subject,
      body: dto.body,
      userId,
    });
  }
}
