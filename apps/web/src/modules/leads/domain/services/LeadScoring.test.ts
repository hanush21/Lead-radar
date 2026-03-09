import { describe, expect, it } from "vitest";
import { calculateLeadScore } from "./LeadScoring";

describe("LeadScoring", () => {
  it("returns a bounded value between 0 and 100", () => {
    const score = calculateLeadScore({
      category: "BARBERSHOP",
      website: null,
      hasBookingSystem: false,
      hasOnlinePayment: false,
      rating: 1,
      reviewCount: 0,
      email: null,
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores weaker digital presence higher", () => {
    const lowMaturity = calculateLeadScore({
      category: "HAIR_SALON",
      website: null,
      hasBookingSystem: false,
      hasOnlinePayment: false,
      rating: 3.8,
      reviewCount: 8,
      email: null,
    });

    const highMaturity = calculateLeadScore({
      category: "HAIR_SALON",
      website: "https://salon.example",
      hasBookingSystem: true,
      hasOnlinePayment: true,
      rating: 4.8,
      reviewCount: 320,
      email: "hola@salon.example",
    });

    expect(lowMaturity).toBeGreaterThan(highMaturity);
  });
});
