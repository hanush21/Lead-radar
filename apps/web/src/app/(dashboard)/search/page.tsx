"use client";

import { useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { BUSINESS_CATEGORIES, type BusinessCategoryKey } from "@/modules/leads/domain/value-objects/BusinessCategory";

interface LeadResult {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  opportunities: Array<{ label: string; suggestedService: string }>;
}

export default function SearchPage() {
  const [category, setCategory] = useState<string>("");
  const [lat, setLat] = useState<number>(40.4168);
  const [lng, setLng] = useState<number>(-3.7038);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [results, setResults] = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!category) {
      setError("Selecciona una categoría");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radiusKm, category }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Error en la búsqueda");
      } else {
        setResults(data.data);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buscar Leads</h1>
        <p className="text-muted-foreground mt-1">
          Busca empresas locales por categoría y zona geográfica
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {Object.entries(BUSINESS_CATEGORIES).map(([key, cat]) => (
                <option key={key} value={key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Latitud</label>
            <input
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(parseFloat(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Longitud</label>
            <input
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(parseFloat(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Radio (km)</label>
            <input
              type="number"
              min="0.5"
              max="50"
              step="0.5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {loading ? "Buscando..." : "Buscar Leads"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900">
              {results.length} resultados encontrados
            </h2>
          </div>
          <div className="divide-y">
            {results.map((lead) => (
              <div key={lead.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-medium text-gray-900">{lead.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {lead.address}
                    </div>
                    {lead.phone && (
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {lead.rating && (
                      <span className="text-sm font-medium text-yellow-600">
                        ⭐ {lead.rating}
                      </span>
                    )}
                    {lead.website ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                        Con web
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                        Sin web
                      </span>
                    )}
                  </div>
                </div>
                {lead.opportunities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lead.opportunities.map((opp, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700"
                        title={opp.suggestedService}
                      >
                        {opp.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
