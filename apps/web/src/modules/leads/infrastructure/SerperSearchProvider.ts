import type { ISearchProvider, SearchResult } from "../domain/services/LeadSearchService";
import type { GeoRadius } from "../domain/value-objects/GeoRadius";

interface SerpApiResponse {
  local_results?: Array<{
    title: string;
    address: string;
    place_id?: string;
    data_id?: string;
    gps_coordinates?: {
      latitude: number;
      longitude: number;
    };
    phone?: string;
    website?: string;
    rating?: number;
    reviews?: number;
  }>;
}

export class SerperSearchProvider implements ISearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://serpapi.com/search.json";

  constructor() {
    const key = process.env.SERPAPI_API_KEY;
    if (!key) throw new Error("SERPAPI_API_KEY is not configured");
    this.apiKey = key;
  }

  async search(geo: GeoRadius, category: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error("SERPAPI_API_KEY is not configured");
    }

    const zoom = getZoomFromRadius(geo.radiusKm);

    const params = new URLSearchParams({
      api_key: this.apiKey,
      engine: "google_maps",
      type: "search",
      q: category,
      ll: `@${geo.lat.toFixed(5)},${geo.lng.toFixed(5)},${zoom}z`,
      gl: "es",
      hl: "es",
      num: Math.min(20, Math.max(5, Math.floor(geo.radiusKm * 2))).toString(),
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SerpApi error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`SerpApi error: ${response.status} ${response.statusText}`);
    }

    const data: SerpApiResponse = await response.json();

    return (data.local_results ?? [])
      .map((place) => ({
        name: place.title,
        address: place.address,
        lat: place.gps_coordinates?.latitude ?? 0,
        lng: place.gps_coordinates?.longitude ?? 0,
        providerPlaceId: place.place_id ?? place.data_id ?? null,
        phone: place.phone ?? null,
        website: place.website ?? null,
        rating: place.rating ?? null,
        reviewCount: place.reviews ?? 0,
      }))
      .filter((place) => place.lat !== 0 && place.lng !== 0);
  }
}

function getZoomFromRadius(radiusKm: number) {
  if (radiusKm <= 1) return 14;
  if (radiusKm <= 3) return 13;
  if (radiusKm <= 8) return 12;
  if (radiusKm <= 15) return 11;
  if (radiusKm <= 30) return 10;
  return 9;
}
