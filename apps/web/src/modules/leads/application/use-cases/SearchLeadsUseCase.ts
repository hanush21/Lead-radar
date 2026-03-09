import type { ISearchProvider } from "../../domain/services/LeadSearchService";
import type { ILeadRepository } from "../../domain/repositories/ILeadRepository";
import type { Opportunity } from "../../domain/entities/Lead";
import type { SearchLeadsDto } from "../dtos/SearchLeadsDto";
import { createGeoRadius } from "../../domain/value-objects/GeoRadius";
import { getCategoryLabel } from "../../domain/value-objects/BusinessCategory";
import { buildLeadDedupeKey } from "../../domain/services/LeadIdentity";
import { calculateLeadScore } from "../../domain/services/LeadScoring";

export interface ILeadAnalyzer {
  analyze(lead: {
    website: string | null;
    hasBookingSystem: boolean;
    hasOnlinePayment: boolean;
    category: string;
  }): Opportunity[];
}

export interface ILeadProcessingQueue {
  enqueuePostprocess(payload: { leadId: string; userId: string }): Promise<boolean>;
}

export interface SearchLeadsResult {
  leads: Awaited<ReturnType<ILeadRepository["createMany"]>>;
  meta: {
    fetched: number;
    insideRadius: number;
    dedupedInMemory: number;
    created: number;
    updated: number;
    deduped: number;
    queuedForEnrichment: number;
    persisted: number;
  };
}

export class SearchLeadsUseCase {
  constructor(
    private readonly searchProvider: ISearchProvider,
    private readonly leadRepository: ILeadRepository,
    private readonly leadAnalyzer: ILeadAnalyzer,
    private readonly leadProcessingQueue?: ILeadProcessingQueue
  ) {}

  async execute(dto: SearchLeadsDto, userId: string): Promise<SearchLeadsResult> {
    const geo = createGeoRadius(dto.lat, dto.lng, dto.radiusKm);
    const searchLabel = getCategoryLabel(dto.category);
    const fetchedResults = await this.searchProvider.search(geo, searchLabel);

    const insideRadius = fetchedResults.filter((result) =>
      isWithinRadiusKm(geo.lat, geo.lng, result.lat, result.lng, geo.radiusKm)
    );
    const uniqueResults = insideRadius.filter(onlyUniqueByBusinessKey);

    const leadsToCreate = uniqueResults.map((result) => {
      const hasBookingSystem = false;
      const hasOnlinePayment = false;
      const opportunities = this.leadAnalyzer.analyze({
        website: result.website,
        hasBookingSystem,
        hasOnlinePayment,
        category: dto.category,
      });
      const leadScore = calculateLeadScore({
        category: dto.category,
        website: result.website,
        hasBookingSystem,
        hasOnlinePayment,
        rating: result.rating,
        reviewCount: result.reviewCount,
        email: null,
      });
      const tags = deriveLeadTags({
        website: result.website,
        hasBookingSystem,
        hasOnlinePayment,
        rating: result.rating,
        reviewCount: result.reviewCount,
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
        provider: "serpapi",
        providerPlaceId: result.providerPlaceId,
        dedupeKey: buildLeadDedupeKey({
          provider: "serpapi",
          providerPlaceId: result.providerPlaceId,
          website: result.website,
          name: result.name,
          address: result.address,
          lat: result.lat,
          lng: result.lng,
        }),
        hasBookingSystem,
        hasOnlinePayment,
        opportunities,
        leadScore,
        segment: deriveLeadSegment(leadScore),
        tags,
        enrichmentStatus: "PENDING" as const,
        lastSeenAt: new Date(),
        sourceQuery: `${searchLabel} near ${dto.lat},${dto.lng} r=${dto.radiusKm}km`,
        userId,
      };
    });

    const persisted = await this.leadRepository.upsertMany(leadsToCreate);
    let queuedForEnrichment = 0;

    if (this.leadProcessingQueue) {
      for (const lead of persisted.leads) {
        try {
          const queued = await this.leadProcessingQueue.enqueuePostprocess({
            leadId: lead.id,
            userId,
          });
          if (queued) queuedForEnrichment++;
        } catch (error) {
          console.error("Failed to enqueue lead postprocess job", {
            leadId: lead.id,
            userId,
            error,
          });
        }
      }
    }

    return {
      leads: persisted.leads,
      meta: {
        fetched: fetchedResults.length,
        insideRadius: insideRadius.length,
        dedupedInMemory: insideRadius.length - uniqueResults.length,
        created: persisted.summary.created,
        updated: persisted.summary.updated,
        deduped: persisted.summary.deduped,
        queuedForEnrichment,
        persisted: persisted.leads.length,
      },
    };
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
  result: { name: string; address: string; website: string | null; lat: number; lng: number; providerPlaceId: string | null },
  index: number,
  all: Array<{ name: string; address: string; website: string | null; lat: number; lng: number; providerPlaceId: string | null }>
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
  providerPlaceId: string | null;
}) {
  if (result.providerPlaceId) return `provider:${result.providerPlaceId}`;

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

function deriveLeadSegment(score: number): "HOT" | "WARM" | "COLD" {
  if (score >= 70) return "HOT";
  if (score >= 45) return "WARM";
  return "COLD";
}

function deriveLeadTags(input: {
  website: string | null;
  hasBookingSystem: boolean;
  hasOnlinePayment: boolean;
  rating: number | null;
  reviewCount: number;
}) {
  const tags: string[] = [];
  if (!input.website) tags.push("NO_WEBSITE");
  if (!input.hasBookingSystem) tags.push("NO_BOOKING");
  if (!input.hasOnlinePayment) tags.push("NO_PAYMENT");
  if (input.rating != null && input.rating < 4.0) tags.push("LOW_REVIEWS");
  if (input.reviewCount < 20) tags.push("LOW_SOCIAL_PROOF");
  return tags;
}
