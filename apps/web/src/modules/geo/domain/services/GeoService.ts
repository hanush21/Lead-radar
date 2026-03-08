export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoArea {
  center: GeoPoint;
  radiusKm: number;
}

export function calculateAreaKm2(radiusKm: number): number {
  return Math.PI * radiusKm * radiusKm;
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const calc =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
