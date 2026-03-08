import type { ILeadRepository } from "../../domain/repositories/ILeadRepository";
import { NotFoundError } from "@/shared/errors/AppError";

export class GetLeadByIdUseCase {
  constructor(private readonly leadRepository: ILeadRepository) {}

  async execute(id: string, userId: string) {
    const lead = await this.leadRepository.findById(id);
    if (!lead || lead.userId !== userId) {
      throw new NotFoundError("Lead", id);
    }
    return lead;
  }
}
