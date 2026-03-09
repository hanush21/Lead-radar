import { createHash } from "crypto";

export interface LeadIdentityInput {
  provider?: string | null;
  providerPlaceId?: string | null;
  website?: string | null;
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export function buildLeadDedupeKey(input: LeadIdentityInput): string {
  const provider = normalize(input.provider) || "serpapi";
  const providerPlaceId = normalize(input.providerPlaceId);
  const website = normalizeWebsite(input.website);
  const name = normalize(input.name);
  const address = normalize(input.address);
  const lat = Number(input.lat ?? 0).toFixed(4);
  const lng = Number(input.lng ?? 0).toFixed(4);

  const identity = providerPlaceId
    ? `provider:${provider}|place:${providerPlaceId}`
    : website
      ? `provider:${provider}|website:${website}`
      : `provider:${provider}|name:${name}|address:${address}|lat:${lat}|lng:${lng}`;

  const hash = createHash("sha256").update(identity).digest("hex");
  return `v1:${hash}`;
}

export function normalizeWebsite(url: string | null | undefined): string {
  const raw = normalize(url);
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

