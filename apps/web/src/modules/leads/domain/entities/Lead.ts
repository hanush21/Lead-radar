export interface Opportunity {
  type: string;
  label: string;
  description: string;
  suggestedService: string;
}

export type LeadStatus = "NEW" | "CONTACTED" | "REPLIED" | "CONVERTED" | "DISCARDED";

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
  opportunities?: Opportunity[];
  sourceQuery: string;
  userId: string;
}
