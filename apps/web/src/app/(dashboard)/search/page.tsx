"use client";

import { useCallback, useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { BUSINESS_CATEGORIES } from "@/modules/leads/domain/value-objects/BusinessCategory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Map from "@/components/ui/map";

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
  const [hasSearched, setHasSearched] = useState(false);

  const handleLocationChange = useCallback((center: [number, number], radius: number) => {
    setLng(center[0]);
    setLat(center[1]);
    setRadiusKm(radius);
  }, []);

  const handleSearch = async () => {
    if (!category) {
      setError("Selecciona una categoria");
      return;
    }

    setHasSearched(true);
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
        setError(data.error?.message ?? "Error en la busqueda");
        setResults([]);
      } else {
        setResults(data.data ?? []);
      }
    } catch {
      setError("Error de conexion");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Buscar Leads</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Selecciona una zona en el mapa y busca empresas locales
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Mapa de Busqueda</CardTitle>
            <CardDescription className="text-base">
              Haz clic en el mapa para seleccionar el centro de busqueda
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Map
              initialCenter={[lng, lat]}
              initialRadius={radiusKm}
              onLocationChange={handleLocationChange}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Parametros de Busqueda</CardTitle>
            <CardDescription className="text-base">
              Configura la categoria y zona para encontrar leads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-input/50 bg-background/50 backdrop-blur-sm px-4 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {Object.entries(BUSINESS_CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={key}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitud</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Longitud</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Radio (km)</Label>
              <Input
                type="number"
                min="0.5"
                max="50"
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Radio actual: {radiusKm}km (~{Math.round(radiusKm * 1000)}m)
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button onClick={handleSearch} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {loading ? "Buscando..." : "Buscar Leads"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {hasSearched && !loading && !error && results.length === 0 && (
        <Card className="border-0 shadow-xl">
          <CardContent className="py-10 text-center text-muted-foreground">
            No se encontraron negocios en el radio seleccionado. Prueba con un radio mayor o mueve el centro.
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">{results.length} resultados encontrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((lead) => (
              <div
                key={lead.id}
                className="p-5 border border-border/50 rounded-xl hover:bg-accent/30 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground text-lg">{lead.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {lead.address}
                    </div>
                    {lead.phone && <p className="text-sm text-muted-foreground">{lead.phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {lead.rating && (
                      <span className="text-sm font-medium text-yellow-600">* {lead.rating}</span>
                    )}
                    {lead.website ? (
                      <span className="text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">
                        Con web
                      </span>
                    ) : (
                      <span className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-700 border border-red-500/20">
                        Sin web
                      </span>
                    )}
                  </div>
                </div>
                {lead.opportunities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lead.opportunities.map((opp, i) => (
                      <span
                        key={i}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20"
                        title={opp.suggestedService}
                      >
                        {opp.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
