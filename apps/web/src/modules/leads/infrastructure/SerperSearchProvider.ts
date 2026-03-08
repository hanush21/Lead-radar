import type { ISearchProvider, SearchResult } from "../domain/services/LeadSearchService";
import type { GeoRadius } from "../domain/value-objects/GeoRadius";

interface SerperPlace {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
}

interface SerperResponse {
  places: SerperPlace[];
}

export class SerperSearchProvider implements ISearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://google.serper.dev/places";

  constructor() {
    const key = process.env.SERPER_API_KEY;
    if (!key) throw new Error("SERPER_API_KEY is not configured");
    this.apiKey = key;
  }

  async search(geo: GeoRadius, category: string): Promise<SearchResult[]> {
    const query = `${category} cerca de`;

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        ll: `@${geo.lat},${geo.lng},${geo.radiusKm}km`,
        num: 20,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data: SerperResponse = await response.json();

    return (data.places ?? []).map((place) => ({
      name: place.title,
      address: place.address,
      lat: place.latitude,
      lng: place.longitude,
      phone: place.phone ?? null,
      website: place.website ?? null,
      rating: place.rating ?? null,
      reviewCount: place.ratingCount ?? 0,
    }));
  }
}
