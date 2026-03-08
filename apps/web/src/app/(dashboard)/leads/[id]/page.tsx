"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Globe, Phone, Mail, MapPin, Star } from "lucide-react";

interface LeadDetail {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  status: string;
  opportunities: Array<{
    type: string;
    label: string;
    description: string;
    suggestedService: string;
  }>;
  createdAt: string;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/leads/${params.id}`)
      .then((res) => res.json())
      .then((data) => setLead(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!lead) {
    return <div className="text-center py-12">Lead no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {lead.address}
              </span>
              {lead.rating && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" /> {lead.rating} ({lead.reviewCount})
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {lead.phone}
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {lead.email}
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {lead.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {lead.opportunities.length > 0 && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Oportunidades Detectadas
              </h2>
              <div className="space-y-3">
                {lead.opportunities.map((opp, i) => (
                  <div key={i} className="rounded-lg border p-4 bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{opp.label}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        {opp.suggestedService}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {opp.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Estado</h2>
            <select
              value={lead.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                await fetch(`/api/v1/leads/${lead.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: newStatus }),
                });
                setLead({ ...lead, status: newStatus });
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="NEW">Nuevo</option>
              <option value="CONTACTED">Contactado</option>
              <option value="REPLIED">Respondido</option>
              <option value="CONVERTED">Convertido</option>
              <option value="DISCARDED">Descartado</option>
            </select>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Categoría</dt>
                <dd className="font-medium">{lead.category}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Coordenadas</dt>
                <dd className="font-mono text-xs">{lead.lat.toFixed(4)}, {lead.lng.toFixed(4)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Creado</dt>
                <dd>{new Date(lead.createdAt).toLocaleDateString("es-ES")}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
