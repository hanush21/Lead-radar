"use client";

import { useEffect, useState } from "react";
import { BarChart3, Users, Mail, TrendingUp, MousePointerClick } from "lucide-react";

interface AnalyticsData {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  totalCampaigns: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  conversionRate: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/analytics/summary")
      .then((res) => res.json())
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) return null;

  const openRate = data.emailsSent > 0 ? ((data.emailsOpened / data.emailsSent) * 100).toFixed(1) : "0";
  const clickRate = data.emailsOpened > 0 ? ((data.emailsClicked / data.emailsOpened) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-muted-foreground mt-1">Métricas detalladas de tu cuenta</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg p-2 bg-blue-50 text-blue-600"><Users className="h-5 w-5" /></div>
            <h3 className="font-semibold text-gray-900">Leads</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.totalLeads}</p>
          <div className="mt-4 space-y-1">
            {Object.entries(data.leadsByStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{status}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg p-2 bg-purple-50 text-purple-600"><Mail className="h-5 w-5" /></div>
            <h3 className="font-semibold text-gray-900">Email</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.emailsSent}</p>
          <p className="text-sm text-muted-foreground">emails enviados</p>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tasa apertura</span>
              <span className="font-medium text-green-600">{openRate}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tasa clicks</span>
              <span className="font-medium text-purple-600">{clickRate}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg p-2 bg-green-50 text-green-600"><TrendingUp className="h-5 w-5" /></div>
            <h3 className="font-semibold text-gray-900">Conversión</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.conversionRate.toFixed(1)}%</p>
          <p className="text-sm text-muted-foreground">tasa de conversión</p>
          <div className="mt-4">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(data.conversionRate, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
