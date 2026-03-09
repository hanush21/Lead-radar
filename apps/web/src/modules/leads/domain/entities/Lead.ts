export interface Opportunity {
  type: string;
  label: string;
  description: string;
  suggestedService: string;
}

export type LeadStatus = "NEW" | "CONTACTED" | "REPLIED" | "CONVERTED" | "DISCARDED";
export type EnrichmentStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";
export type LeadSegment = "HOT" | "WARM" | "COLD";

export interface Lead {
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
  status: LeadStatus;
  provider: string;
  providerPlaceId: string | null;
  dedupeKey: string;
  leadScore: number;
  enrichmentStatus: EnrichmentStatus;
  segment: LeadSegment;
  tags: string[];
  lastSeenAt: Date;
  opportunities: Opportunity[];
  sourceQuery: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadInput {
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number;
  hasBookingSystem?: boolean;
  hasOnlinePayment?: boolean;
  provider: string;
  providerPlaceId?: string | null;
  dedupeKey: string;
  leadScore?: number;
  enrichmentStatus?: EnrichmentStatus;
  segment?: LeadSegment;
  tags?: string[];
  lastSeenAt?: Date;
  opportunities?: Opportunity[];
  sourceQuery: string;
  userId: string;
}
