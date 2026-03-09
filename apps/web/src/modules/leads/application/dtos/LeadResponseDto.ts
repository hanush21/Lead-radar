import type { Lead } from "../../domain/entities/Lead";

export interface LeadResponseDto {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  hasBookingSystem: boolean;
  hasOnlinePayment: boolean;
  status: string;
  leadScore: number;
  enrichmentStatus: string;
  segment: string;
  tags: string[];
  lastSeenAt: string;
  opportunities: Array<{
    type: string;
    label: string;
    description: string;
    suggestedService: string;
  }>;
  sourceQuery: string;
  createdAt: string;
}

export function toLeadResponseDto(lead: Lead): LeadResponseDto {
  return {
    id: lead.id,
    name: lead.name,
    category: lead.category,
    address: lead.address,
    lat: lead.lat,
    lng: lead.lng,
    phone: lead.phone,
    email: lead.email,
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    hasBookingSystem: lead.hasBookingSystem,
    hasOnlinePayment: lead.hasOnlinePayment,
    status: lead.status,
    leadScore: lead.leadScore,
    enrichmentStatus: lead.enrichmentStatus,
    segment: lead.segment,
    tags: lead.tags,
    lastSeenAt: lead.lastSeenAt.toISOString(),
    opportunities: lead.opportunities,
    sourceQuery: lead.sourceQuery,
    createdAt: lead.createdAt.toISOString(),
  };
}
