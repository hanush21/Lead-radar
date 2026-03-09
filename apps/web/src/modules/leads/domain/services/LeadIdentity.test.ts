import { describe, expect, it } from "vitest";
import { buildLeadDedupeKey } from "./LeadIdentity";

describe("LeadIdentity", () => {
  it("prioritizes providerPlaceId when present", () => {
    const a = buildLeadDedupeKey({
      provider: "serpapi",
      providerPlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
      website: "https://example.com",
      name: "Business A",
      address: "Street 1",
      lat: 41.3874,
      lng: 2.1686,
    });

    const b = buildLeadDedupeKey({
      provider: "serpapi",
      providerPlaceId: "chijn1t_tdeuemsrusoyg83fry4",
      website: "https://another.com",
      name: "Business B",
      address: "Street 2",
      lat: 40.4168,
      lng: -3.7038,
    });

    expect(a).toBe(b);
  });

  it("normalizes website when providerPlaceId is absent", () => {
    const a = buildLeadDedupeKey({
      provider: "serpapi",
      website: "https://www.Example.com/",
      name: "Business A",
      address: "Street 1",
      lat: 41.3874,
      lng: 2.1686,
    });

    const b = buildLeadDedupeKey({
      provider: "serpapi",
      website: "example.com",
      name: "Business A",
      address: "Street 1",
      lat: 41.3874,
      lng: 2.1686,
    });

    expect(a).toBe(b);
  });
});
