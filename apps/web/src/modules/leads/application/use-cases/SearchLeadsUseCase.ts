import type { ISearchProvider } from "../../domain/services/LeadSearchService";
import type { ILeadRepository } from "../../domain/repositories/ILeadRepository";
import type { Opportunity } from "../../domain/entities/Lead";
import type { SearchLeadsDto } from "../dtos/SearchLeadsDto";
import { createGeoRadius } from "../../domain/value-objects/GeoRadius";

export interface ILeadAnalyzer {
  analyze(lead: {
    website: string | null;
    hasBookingSystem: boolean;
    hasOnlinePayment: boolean;
    category: string;
  }): Opportunity[];
}

export class SearchLeadsUseCase {
  constructor(
    private readonly searchProvider: ISearchProvider,
    private readonly leadRepository: ILeadRepository,
    private readonly leadAnalyzer: ILeadAnalyzer
  ) {}

  async execute(dto: SearchLeadsDto, userId: string) {
    const geo = createGeoRadius(dto.lat, dto.lng, dto.radiusKm);
    const results = await this.searchProvider.search(geo, dto.category);

    const leadsToCreate = results.map((result) => {
      const opportunities = this.leadAnalyzer.analyze({
        website: result.website,
        hasBookingSystem: false,
        hasOnlinePayment: false,
        category: dto.category,
      });

      return {
        name: result.name,
        category: dto.category,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
        phone: result.phone,
        website: result.website,
        rating: result.rating,
        reviewCount: result.reviewCount,
        opportunities,
        sourceQuery: `${dto.category} near ${dto.lat},${dto.lng} r=${dto.radiusKm}km`,
        userId,
      };
    });

    const leads = await this.leadRepository.createMany(leadsToCreate);
    return leads;
  }
}
