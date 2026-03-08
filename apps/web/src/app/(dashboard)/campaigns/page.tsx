"use client";

import { useEffect, useState } from "react";
import { Mail, Plus, Send } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-50 text-gray-600" },
  SENDING: { label: "Enviando", color: "bg-yellow-50 text-yellow-700" },
  SENT: { label: "Enviada", color: "bg-green-50 text-green-700" },
  PAUSED: { label: "Pausada", color: "bg-orange-50 text-orange-700" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = () => {
    setLoading(true);
    fetch("/api/v1/campaigns")
      .then((res) => res.json())
      .then((data) => setCampaigns(data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: "", subject: "", body: "" });
        setShowCreate(false);
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus campañas de email
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Campaña
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Crear Campaña</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Mi campaña"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Asunto</label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Asunto del email"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Contenido (HTML)</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="<p>Hola {{name}}, ..."
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !form.name || !form.subject || !form.body}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
            {creating ? "Creando..." : "Crear"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 rounded-xl border bg-white">
          <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-gray-900">No hay campañas aún</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Crea tu primera campaña de email
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const s = statusLabels[campaign.status] ?? statusLabels.DRAFT;
            return (
              <div key={campaign.id} className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 truncate">{campaign.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                    {s.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(campaign.createdAt).toLocaleDateString("es-ES")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
