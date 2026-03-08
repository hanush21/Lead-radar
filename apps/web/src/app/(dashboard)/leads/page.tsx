"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, MapPin, ExternalLink } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  status: string;
  opportunities: Array<{ label: string }>;
  createdAt: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  NEW: { label: "Nuevo", color: "bg-blue-50 text-blue-700" },
  CONTACTED: { label: "Contactado", color: "bg-yellow-50 text-yellow-700" },
  REPLIED: { label: "Respondido", color: "bg-green-50 text-green-700" },
  CONVERTED: { label: "Convertido", color: "bg-emerald-50 text-emerald-700" },
  DISCARDED: { label: "Descartado", color: "bg-gray-50 text-gray-500" },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/leads?page=${page}&pageSize=20`)
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.data ?? []);
        setTotal(data.meta?.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-muted-foreground mt-1">
            {total} leads en tu base de datos
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Users className="h-4 w-4" />
          Buscar Nuevos
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 rounded-xl border bg-white">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-gray-900">No hay leads aún</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Empieza buscando empresas en la sección de búsqueda
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Oportunidades</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((lead) => {
                const status = statusLabels[lead.status] ?? statusLabels.NEW;
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {lead.address}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{lead.email ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{lead.phone ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.opportunities.slice(0, 2).map((opp, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                            {opp.label}
                          </span>
                        ))}
                        {lead.opportunities.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{lead.opportunities.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm text-primary disabled:text-muted-foreground"
              >
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
                className="text-sm text-primary disabled:text-muted-foreground"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
