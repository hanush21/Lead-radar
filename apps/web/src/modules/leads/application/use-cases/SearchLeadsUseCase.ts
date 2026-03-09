import type { ISearchProvider } from "../../domain/services/LeadSearchService";
import type { ILeadRepository } from "../../domain/repositories/ILeadRepository";
import type { Opportunity } from "../../domain/entities/Lead";
import type { SearchLeadsDto } from "../dtos/SearchLeadsDto";
import { createGeoRadius } from "../../domain/value-objects/GeoRadius";
import { getCategoryLabel } from "../../domain/value-objects/BusinessCategory";

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
    const searchLabel = getCategoryLabel(dto.category);
    const results = await this.searchProvider.search(geo, searchLabel);
    const filteredResults = results
      .filter((result) => isWithinRadiusKm(geo.lat, geo.lng, result.lat, result.lng, geo.radiusKm))
      .filter(onlyUniqueByBusinessKey);

    const leadsToCreate = filteredResults.map((result) => {
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
        sourceQuery: `${searchLabel} near ${dto.lat},${dto.lng} r=${dto.radiusKm}km`,
        userId,
      };
    });

    const leads = await this.leadRepository.createMany(leadsToCreate);
    return leads;
  }
}

function isWithinRadiusKm(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusKm: number
) {
  return haversineDistanceKm(centerLat, centerLng, pointLat, pointLng) <= radiusKm;
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function onlyUniqueByBusinessKey(
  result: { name: string; address: string; website: string | null; lat: number; lng: number },
  index: number,
  all: Array<{ name: string; address: string; website: string | null; lat: number; lng: number }>
) {
  const key = getBusinessKey(result);
  return all.findIndex((candidate) => getBusinessKey(candidate) === key) === index;
}

function getBusinessKey(result: {
  name: string;
  address: string;
  website: string | null;
  lat: number;
  lng: number;
}) {
  const website = normalize(result.website);
  if (website) return `web:${website}`;

  const name = normalize(result.name);
  const address = normalize(result.address);
  if (name && address) return `name_address:${name}|${address}`;

  const roundedLat = result.lat.toFixed(4);
  const roundedLng = result.lng.toFixed(4);
  return `coords:${roundedLat}|${roundedLng}`;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}
