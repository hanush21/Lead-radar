import type { GeoRadius } from "../value-objects/GeoRadius";

export interface SearchResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  providerPlaceId: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
}

export interface ISearchProvider {
  search(geo: GeoRadius, category: string): Promise<SearchResult[]>;
}
