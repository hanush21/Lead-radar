export const MAPBOX_CONFIG = {
  style: "mapbox://styles/mapbox/streets-v12",
  defaultCenter: { lat: 40.4168, lng: -3.7038 } as const, // Madrid
  defaultZoom: 12,
  radiusColor: "rgba(59, 130, 246, 0.15)",
  radiusBorderColor: "rgba(59, 130, 246, 0.6)",
  markerColor: "#3B82F6",
  maxRadiusKm: 50,
  minRadiusKm: 0.5,
};

export function getMapboxToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is not configured");
  return token;
}
