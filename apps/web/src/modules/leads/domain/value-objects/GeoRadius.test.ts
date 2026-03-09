import { describe, expect, it } from "vitest";
import { createGeoRadius, getBoundingBox } from "./GeoRadius";

describe("GeoRadius", () => {
  it("creates a valid radius", () => {
    const geo = createGeoRadius(40.4168, -3.7038, 5);
    expect(geo).toEqual({
      lat: 40.4168,
      lng: -3.7038,
      radiusKm: 5,
    });
  });

  it("throws for invalid latitude", () => {
    expect(() => createGeoRadius(200, -3.7038, 5)).toThrow(
      "Latitude must be between -90 and 90"
    );
  });

  it("returns a bounding box containing the center", () => {
    const geo = createGeoRadius(40.4168, -3.7038, 5);
    const box = getBoundingBox(geo);
    expect(box.minLat).toBeLessThan(geo.lat);
    expect(box.maxLat).toBeGreaterThan(geo.lat);
    expect(box.minLng).toBeLessThan(geo.lng);
    expect(box.maxLng).toBeGreaterThan(geo.lng);
  });
});
