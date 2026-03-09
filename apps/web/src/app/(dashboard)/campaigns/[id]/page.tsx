"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface CampaignStats {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  delivered: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  openedUnique: number;
  clickedUnique: number;
  converted: number;
  openRate: number;
  clickRate: number;
  ctor: number;
  conversionRate: number;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/campaigns/${params.id}/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data.data))
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Estadisticas de Campana</h1>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: "Total", value: stats.total, color: "text-gray-900" },
              { label: "Enviados", value: stats.sent, color: "text-blue-600" },
              { label: "Entregados", value: stats.delivered, color: "text-emerald-600" },
              { label: "Abiertos", value: stats.openedUnique, color: "text-green-600" },
              { label: "Clicks", value: stats.clickedUnique, color: "text-purple-600" },
              { label: "Convertidos", value: stats.converted, color: "text-indigo-600" },
              { label: "Fallidos", value: stats.failed, color: "text-red-600" },
              { label: "Rebotes", value: stats.bounced, color: "text-rose-600" },
              { label: "Quejas", value: stats.complained, color: "text-orange-600" },
              { label: "Bajas", value: stats.unsubscribed, color: "text-slate-600" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Open Rate", value: `${stats.openRate.toFixed(1)}%` },
              { label: "Click Rate", value: `${stats.clickRate.toFixed(1)}%` },
              { label: "CTOR", value: `${stats.ctor.toFixed(1)}%` },
              { label: "Conversion Rate", value: `${stats.conversionRate.toFixed(1)}%` },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{kpi.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
