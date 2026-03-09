"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl, { SourceSpecification } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapProps {
  initialCenter: [number, number];
  initialRadius: number;
  onLocationChange: (center: [number, number], radiusKm: number) => void;
}

export default function Map({ initialCenter, initialRadius, onLocationChange }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const circle = useRef<SourceSpecification | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const initialCenterRef = useRef(initialCenter);
  const initialRadiusRef = useRef(initialRadius);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const removeCircleFromMap = useCallback(() => {
    if (!map.current) return;
    if (map.current.getLayer("circle-fill")) {
      map.current.removeLayer("circle-fill");
    }
    if (map.current.getLayer("circle-border")) {
      map.current.removeLayer("circle-border");
    }
    if (map.current.getSource("circle")) {
      map.current.removeSource("circle");
    }
  }, []);

  const updateCircle = useCallback((center: [number, number], radiusKm: number) => {
    if (!map.current) return;

    const coordinates: [number, number][] = [];
    const numPoints = 64;
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const lat = center[1] + (radiusKm / 111.32) * Math.cos(angle);
      const lng = center[0] + (radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180))) * Math.sin(angle);
      coordinates.push([lng, lat]);
    }

    removeCircleFromMap();

    circle.current = {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
        properties: {},
      },
    } as SourceSpecification;

    const addCircleToMap = () => {
      if (!map.current || !circle.current) return;

      removeCircleFromMap();
      map.current.addSource("circle", circle.current);
      map.current.addLayer({
        id: "circle-fill",
        type: "fill",
        source: "circle",
        paint: {
          "fill-color": "#2563EB",
          "fill-opacity": 0.16,
        },
      });
      map.current.addLayer({
        id: "circle-border",
        type: "line",
        source: "circle",
        paint: {
          "line-color": "#1D4ED8",
          "line-width": 2.5,
          "line-opacity": 0.8,
        },
      });
    };

    if (map.current.isStyleLoaded()) {
      addCircleToMap();
    } else {
      map.current.once("load", addCircleToMap);
    }
  }, [removeCircleFromMap]);

  useEffect(() => {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) {
      setMapError("Falta NEXT_PUBLIC_MAPBOX_TOKEN. Revisa tu .env.local.");
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    if (!mapContainer.current) return;

    const startCenter = initialCenterRef.current;
    const startRadius = initialRadiusRef.current;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: startCenter,
      zoom: 12,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.ScaleControl(), "bottom-left");
    map.current.scrollZoom.setWheelZoomRate(1 / 190);
    map.current.scrollZoom.setZoomRate(1 / 75);

    marker.current = new mapboxgl.Marker({ color: "#2563EB" })
      .setLngLat(startCenter)
      .addTo(map.current!);

    map.current.on("load", () => {
      setMapReady(true);
      setMapError(null);
      map.current?.resize();
      updateCircle(startCenter, startRadius);
    });

    map.current.on("error", () => {
      setMapError("No se pudo cargar el mapa. Verifica el token de Mapbox.");
    });

    map.current.on("click", (e) => {
      const newCenter = e.lngLat.toArray() as [number, number];
      const currentRadius = initialRadiusRef.current;

      if (marker.current) {
        marker.current.setLngLat(newCenter);
      }

      updateCircle(newCenter, currentRadius);
      onLocationChangeRef.current(newCenter, currentRadius);
    });

    map.current.on("zoom", () => {
      if (map.current) {
        const center = map.current.getCenter().toArray() as [number, number];
        const zoom = map.current.getZoom();
        const newRadius = Math.round(50 / Math.pow(2, zoom - 12));
        const clampedRadius = Math.max(1, Math.min(50, newRadius));

        initialRadiusRef.current = clampedRadius;
        updateCircle(center, clampedRadius);
        onLocationChangeRef.current(center, clampedRadius);
      }
    });

    return () => {
      setMapReady(false);
      map.current?.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
  }, [updateCircle]);

  useEffect(() => {
    initialRadiusRef.current = initialRadius;
    if (map.current) {
      const currentCenter = map.current.getCenter().toArray() as [number, number];
      updateCircle(currentCenter, initialRadius);
    }
  }, [initialRadius, updateCircle]);

  useEffect(() => {
    initialCenterRef.current = initialCenter;
    if (map.current) {
      marker.current?.setLngLat(initialCenter);
      updateCircle(initialCenter, initialRadiusRef.current);
      map.current.easeTo({ center: initialCenter, duration: 350 });
    }
  }, [initialCenter, updateCircle]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-border/50 bg-gradient-to-br from-sky-100 via-blue-50 to-emerald-50">
      {!mapReady && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-700 bg-white/50 backdrop-blur-[1px]">
          Cargando mapa...
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-center px-6 text-sm text-red-700 bg-red-50/95">
          {mapError}
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full min-h-[430px]" />
    </div>
  );
}
