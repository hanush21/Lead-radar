export interface GeoRadius {
  lat: number;
  lng: number;
  radiusKm: number;
}

export function createGeoRadius(lat: number, lng: number, radiusKm: number): GeoRadius {
  if (lat < -90 || lat > 90) throw new Error("Latitude must be between -90 and 90");
  if (lng < -180 || lng > 180) throw new Error("Longitude must be between -180 and 180");
  if (radiusKm <= 0 || radiusKm > 100) throw new Error("Radius must be between 0 and 100 km");
  return { lat, lng, radiusKm };
}

export function getBoundingBox(geo: GeoRadius) {
  const latDelta = geo.radiusKm / 111.32;
  const lngDelta = geo.radiusKm / (111.32 * Math.cos((geo.lat * Math.PI) / 180));
  return {
    minLat: geo.lat - latDelta,
    maxLat: geo.lat + latDelta,
    minLng: geo.lng - lngDelta,
    maxLng: geo.lng + lngDelta,
  };
}
