import { categoryNeedsBooking } from "../value-objects/BusinessCategory";

export interface LeadScoreInput {
  category: string;
  website: string | null;
  hasBookingSystem: boolean;
  hasOnlinePayment: boolean;
  rating: number | null;
  reviewCount: number;
  email: string | null;
}

export function calculateLeadScore(input: LeadScoreInput): number {
  let score = 25;

  if (!input.website) score += 30;
  if (!input.email) score -= 5;

  if (input.rating == null) {
    score += 8;
  } else if (input.rating < 4.0) {
    score += 16;
  } else if (input.rating < 4.5) {
    score += 8;
  }

  if (input.reviewCount < 20) {
    score += 12;
  } else if (input.reviewCount < 80) {
    score += 6;
  }

  if (categoryNeedsBooking(input.category) && !input.hasBookingSystem) {
    score += 10;
  }

  if (!input.hasOnlinePayment) {
    score += 8;
  }

  return Math.max(0, Math.min(100, score));
}

