"use client";

import { useEffect, useState } from "react";
import { Search, Users, Mail, TrendingUp } from "lucide-react";

interface DashboardStats {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  totalCampaigns: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  conversionRate: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/analytics")
      .then((res) => res.json())
      .then((data) => setStats(data.data))
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

  const cards = [
    {
      label: "Total Leads",
      value: stats?.totalLeads ?? 0,
      icon: Users,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Campañas",
      value: stats?.totalCampaigns ?? 0,
      icon: Mail,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Emails Enviados",
      value: stats?.emailsSent ?? 0,
      icon: Search,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Tasa Conversión",
      value: `${(stats?.conversionRate ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Resumen de tu actividad en LeadRadar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <div className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
