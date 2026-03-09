"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Plus, Send, Users, Search, Eye, MapPin, RefreshCw } from "lucide-react";
import { BUSINESS_CATEGORIES } from "@/modules/leads/domain/value-objects/BusinessCategory";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

interface CampaignTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  isDefault: boolean;
  subjectTemplate: string;
}

interface LeadOption {
  id: string;
  name: string;
  category: string;
  email: string | null;
  leadScore: number;
  segment: string;
  lat: number;
  lng: number;
  address: string;
}

interface LocationSuggestion {
  label: string;
  lat: number;
  lng: number;
}

interface PreviewPayload {
  subject: string;
  html: string;
  aiPersonalized: boolean;
  sampleLead: {
    id: string;
    name: string;
    category: string;
    segment: string;
  };
}

interface CategoryLeadStats {
  category: string | null;
  total: number;
  withEmail: number;
  withoutEmail: number;
  enrichmentCandidates: number;
}

interface EnrichmentProgressLeadEvent {
  id: string;
  name: string;
  status: "DONE" | "FAILED" | "PENDING" | "PROCESSING";
  email: string | null;
  completedAt: string | null;
}

interface EnrichmentProgress {
  batchId: string;
  total: number;
  pending: number;
  processing: number;
  done: number;
  failed: number;
  completed: number;
  withEmail: number;
  progressPct: number;
  isCompleted: boolean;
  recentLeads: EnrichmentProgressLeadEvent[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-50 text-gray-600" },
  SENDING: { label: "Enviando", color: "bg-yellow-50 text-yellow-700" },
  SENT: { label: "Enviada", color: "bg-green-50 text-green-700" },
  PAUSED: { label: "Pausada", color: "bg-orange-50 text-orange-700" },
};

const categoryOptions = Object.entries(BUSINESS_CATEGORIES).map(([value, item]) => ({
  value,
  label: item.label,
}));

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function hasValidEmail(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<PreviewPayload | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryLeadStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [enrichingEmails, setEnrichingEmails] = useState(false);
  const [enrichmentBatchId, setEnrichmentBatchId] = useState("");
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  const [enrichmentConsoleLines, setEnrichmentConsoleLines] = useState<string[]>([]);
  const [enrichmentScope, setEnrichmentScope] = useState<"CATEGORY" | "ALL">("CATEGORY");
  const enrichmentConsoleRef = useRef<HTMLDivElement | null>(null);
  const seenProgressEventsRef = useRef<Set<string>>(new Set());
  const lastProgressSnapshotRef = useRef<{
    total: number;
    pending: number;
    processing: number;
    done: number;
    failed: number;
    withEmail: number;
  } | null>(null);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [notesHtml, setNotesHtml] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("BARBERSHOP");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [useAiPersonalization, setUseAiPersonalization] = useState(true);
  const [previewLeadId, setPreviewLeadId] = useState<string>("");

  const [locationQuery, setLocationQuery] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationResults, setLocationResults] = useState<LocationSuggestion[]>([]);
  const [locationCenter, setLocationCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locationRadiusKm, setLocationRadiusKm] = useState(5);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => template.category === selectedCategory || template.category === "OTHER");
  }, [templates, selectedCategory]);

  const leadsByLocation = useMemo(() => {
    if (!locationCenter) return leads;
    return leads.filter((lead) => {
      return (
        haversineDistanceKm(locationCenter.lat, locationCenter.lng, lead.lat, lead.lng) <= locationRadiusKm
      );
    });
  }, [leads, locationCenter, locationRadiusKm]);
  const locationFilterBlocking = Boolean(locationCenter) && leadsByLocation.length === 0 && leads.length > 0;
  const visibleLeads = useMemo(() => {
    if (!locationCenter) return leads;
    return locationFilterBlocking ? leads : leadsByLocation;
  }, [leads, leadsByLocation, locationCenter, locationFilterBlocking]);

  const selectedLeadsWithEmail = useMemo(() => {
    return visibleLeads.filter((lead) => selectedLeadIds.includes(lead.id) && hasValidEmail(lead.email));
  }, [visibleLeads, selectedLeadIds]);
  const sendableLeadsInView = useMemo(() => {
    return visibleLeads.filter((lead) => hasValidEmail(lead.email));
  }, [visibleLeads]);
  const loadedLeadsWithEmail = useMemo(() => {
    return leads.filter((lead) => hasValidEmail(lead.email)).length;
  }, [leads]);

  const appendEnrichmentConsoleLine = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("es-ES", { hour12: false });
    setEnrichmentConsoleLines((current) => [...current, `[${time}] ${message}`].slice(-120));
  }, []);

  useEffect(() => {
    void Promise.all([fetchCampaigns(), fetchTemplates()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!showCreate) return;
    void fetchCategoryStats(selectedCategory);
  }, [showCreate, selectedCategory]);

  useEffect(() => {
    if (!enrichmentConsoleRef.current) return;
    enrichmentConsoleRef.current.scrollTop = enrichmentConsoleRef.current.scrollHeight;
  }, [enrichmentConsoleLines]);

  useEffect(() => {
    if (filteredTemplates.length === 0) {
      setSelectedTemplateId("");
      return;
    }

    if (!filteredTemplates.some((template) => template.id === selectedTemplateId)) {
      const preferred =
        filteredTemplates.find((template) => template.category === selectedCategory && template.isDefault) ||
        filteredTemplates.find((template) => template.isDefault) ||
        filteredTemplates[0];
      setSelectedTemplateId(preferred.id);
      setSubject(preferred.subjectTemplate);
    }
  }, [filteredTemplates, selectedCategory, selectedTemplateId]);

  useEffect(() => {
    if (!previewLeadId && visibleLeads.length > 0) {
      setPreviewLeadId(visibleLeads[0].id);
    }
    if (previewLeadId && !visibleLeads.some((lead) => lead.id === previewLeadId)) {
      setPreviewLeadId(visibleLeads[0]?.id ?? "");
    }
  }, [visibleLeads, previewLeadId]);

  useEffect(() => {
    const sendableIds = new Set(sendableLeadsInView.map((lead) => lead.id));
    setSelectedLeadIds((current) => current.filter((id) => sendableIds.has(id)));
  }, [sendableLeadsInView]);

  async function fetchCampaigns() {
    const res = await fetch("/api/v1/campaigns");
    const data = await res.json();
    setCampaigns(data.data ?? []);
  }

  async function fetchTemplates() {
    const res = await fetch("/api/v1/campaigns/templates");
    const data = await res.json();
    setTemplates(data.data ?? []);
  }

  async function fetchCategoryStats(category: string) {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({ category });
      const res = await fetch(`/api/v1/leads/stats?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setCategoryStats(null);
        return;
      }
      setCategoryStats(data.data ?? null);
    } catch (error) {
      console.error(error);
      setCategoryStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  const fetchEnrichmentProgress = useCallback(async (batchId: string) => {
    try {
      const res = await fetch(`/api/v1/leads/enrich-emails/${batchId}/progress`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) return null;

      const progress = data.data as EnrichmentProgress;
      setEnrichmentProgress(progress);

      const previous = lastProgressSnapshotRef.current;
      if (!previous) {
        appendEnrichmentConsoleLine(
          `Lote iniciado: ${progress.total} leads. Pendientes ${progress.pending}, en proceso ${progress.processing}.`
        );
      } else if (
        previous.done !== progress.done ||
        previous.failed !== progress.failed ||
        previous.processing !== progress.processing ||
        previous.pending !== progress.pending ||
        previous.withEmail !== progress.withEmail
      ) {
        appendEnrichmentConsoleLine(
          `Progreso ${progress.completed}/${progress.total} | done ${progress.done} | failed ${progress.failed} | processing ${progress.processing} | emails ${progress.withEmail}.`
        );
      }

      const recentSorted = [...(progress.recentLeads ?? [])].reverse();
      for (const event of recentSorted) {
        const key = `${event.id}:${event.status}:${event.completedAt ?? ""}`;
        if (seenProgressEventsRef.current.has(key)) continue;
        seenProgressEventsRef.current.add(key);
        const leadEmail = hasValidEmail(event.email) ? ` | email ${event.email}` : "";
        appendEnrichmentConsoleLine(`${event.status} -> ${event.name}${leadEmail}`);
      }

      lastProgressSnapshotRef.current = {
        total: progress.total,
        pending: progress.pending,
        processing: progress.processing,
        done: progress.done,
        failed: progress.failed,
        withEmail: progress.withEmail,
      };

      return progress;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, [appendEnrichmentConsoleLine]);

  useEffect(() => {
    if (!enrichmentBatchId) return;

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      const progress = await fetchEnrichmentProgress(enrichmentBatchId);
      if (!active || !progress) return;
      if (progress.isCompleted) {
        appendEnrichmentConsoleLine("Lote completado.");
        await fetchCategoryStats(selectedCategory);
        if (timer) clearInterval(timer);
      }
    };

    void tick();
    timer = setInterval(() => {
      void tick();
    }, 4000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [appendEnrichmentConsoleLine, enrichmentBatchId, fetchEnrichmentProgress, selectedCategory]);

  async function fetchLeadsByCategory(category: string) {
    setLoadingLeads(true);
    setCreateError("");
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "500",
        category,
      });
      const res = await fetch(`/api/v1/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data.data ?? []);
      await fetchCategoryStats(category);
      setSelectedLeadIds([]);
      setPreviewLeadId("");
      setPreviewData(null);
    } catch (error) {
      console.error(error);
      setCreateError("No se pudieron cargar leads de la categoria seleccionada.");
    } finally {
      setLoadingLeads(false);
    }
  }

  async function handleEnrichEmails(scope: "CATEGORY" | "ALL") {
    setEnrichingEmails(true);
    setCreateError("");
    setCreateSuccess("");
    try {
      const res = await fetch("/api/v1/leads/enrich-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          allCategories: scope === "ALL",
          limit: scope === "ALL" ? 1000 : 400,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error?.message ?? "No se pudo encolar el enriquecimiento de emails.");
        return;
      }

      const result = data.data ?? {};
      const batchId = typeof result.batchId === "string" ? result.batchId : "";
      setEnrichmentScope(scope);
      setEnrichmentProgress(null);
      setEnrichmentConsoleLines([]);
      seenProgressEventsRef.current = new Set();
      lastProgressSnapshotRef.current = null;

      if (batchId) {
        setEnrichmentBatchId(batchId);
        appendEnrichmentConsoleLine(
          `Encolado lote ${batchId} | scope ${scope} | candidatos ${result.candidates ?? 0} | queued ${result.queued ?? 0}.`
        );
      } else {
        setEnrichmentBatchId("");
        appendEnrichmentConsoleLine("No hay candidatos sin email+website para enriquecer.");
      }
      setCreateSuccess(
        `Enriquecimiento encolado (${scope === "ALL" ? "todas las categorias" : selectedCategory}). Candidatos: ${result.candidates ?? 0}, encolados: ${result.queued ?? 0}.`
      );
      await fetchCategoryStats(selectedCategory);
    } catch (error) {
      console.error(error);
      setCreateError("No se pudo encolar el enriquecimiento de emails.");
    } finally {
      setEnrichingEmails(false);
    }
  }

  async function handleLocationSearch() {
    const query = locationQuery.trim();
    if (!query) return;

    setLocationLoading(true);
    setCreateError("");
    setLocationResults([]);

    try {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapboxToken) {
        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${mapboxToken}&limit=5&language=es`;
        const mapboxRes = await fetch(mapboxUrl);
        const mapboxData = await mapboxRes.json();
        const suggestions: LocationSuggestion[] = (mapboxData?.features ?? [])
          .filter((feature: { center?: number[]; place_name?: string }) => Array.isArray(feature.center))
          .map((feature: { center: number[]; place_name: string }) => ({
            label: feature.place_name,
            lng: feature.center[0],
            lat: feature.center[1],
          }));

        if (suggestions.length > 0) {
          setLocationResults(suggestions);
          return;
        }
      }

      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
        query
      )}`;
      const fallbackRes = await fetch(fallbackUrl);
      const fallbackData = await fallbackRes.json();
      const fallbackSuggestions: LocationSuggestion[] = (fallbackData ?? []).map(
        (item: { display_name: string; lat: string; lon: string }) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        })
      );
      setLocationResults(fallbackSuggestions);
    } catch (error) {
      console.error(error);
      setCreateError("No se pudo buscar la ubicacion.");
    } finally {
      setLocationLoading(false);
    }
  }

  function toggleLead(leadId: string, hasEmail: boolean) {
    if (!hasEmail) return;
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  }

  function toggleAllLeads() {
    const allIds = sendableLeadsInView.map((lead) => lead.id);
    setSelectedLeadIds((current) => (current.length === allIds.length ? [] : allIds));
  }

  function resetCreateForm() {
    setName("");
    setSubject(filteredTemplates[0]?.subjectTemplate ?? "");
    setNotesHtml("");
    setSelectedLeadIds([]);
    setLeads([]);
    setLocationQuery("");
    setLocationResults([]);
    setLocationCenter(null);
    setLocationRadiusKm(5);
    setPreviewLeadId("");
    setPreviewData(null);
    setPreviewError("");
    setEnrichmentBatchId("");
    setEnrichmentProgress(null);
    setEnrichmentConsoleLines([]);
    setEnrichmentScope("CATEGORY");
    seenProgressEventsRef.current = new Set();
    lastProgressSnapshotRef.current = null;
    setCreateError("");
    setCreateSuccess("");
  }

  async function generatePreview() {
    setPreviewLoading(true);
    setPreviewError("");

    try {
      const res = await fetch("/api/v1/campaigns/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId || undefined,
          leadId: previewLeadId || undefined,
          category: selectedCategory,
          campaignName: name.trim() || "Preview Campaign",
          subject: subject.trim(),
          body: notesHtml.trim(),
          useAiPersonalization,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error?.message ?? "No se pudo generar la preview.");
        return;
      }
      setPreviewData(data.data);
    } catch (error) {
      console.error(error);
      setPreviewError("No se pudo generar la preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreateAndSend() {
    if (!name.trim()) {
      setCreateError("Debes indicar un nombre para la campana.");
      return;
    }

    const leadIdsToSend = selectedLeadIds.filter((leadId) =>
      sendableLeadsInView.some((lead) => lead.id === leadId)
    );

    if (leadIdsToSend.length === 0) {
      setCreateError("Selecciona al menos 1 lead con email para poder enviar la campana.");
      return;
    }

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const createRes = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim() || "Nueva campana LeadRadar",
          body:
            notesHtml.trim() ||
            "<p>Campana creada con plantilla profesional y personalizacion por lead.</p>",
        }),
      });

      const created = await createRes.json();
      if (!createRes.ok) {
        setCreateError(created.error?.message ?? "No se pudo crear la campana.");
        return;
      }

      const campaignId = created?.data?.id as string;

      if (campaignId) {
        const sendRes = await fetch(`/api/v1/campaigns/${campaignId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadIds: leadIdsToSend,
            templateId: selectedTemplateId || undefined,
            useAiPersonalization,
          }),
        });

        const sendData = await sendRes.json();
        if (!sendRes.ok) {
          setCreateError(sendData.error?.message ?? "Campana creada, pero fallo el envio.");
        } else {
          const sent = (sendData.data ?? []).filter((item: { success: boolean }) => item.success).length;
          const failed = (sendData.data ?? []).length - sent;
          setCreateSuccess(
            `Campana creada y procesada. Exitos: ${sent}, fallidos: ${failed}. Enviables en seleccion: ${leadIdsToSend.length}.`
          );
        }
      }

      await fetchCampaigns();
      setShowCreate(false);
      resetCreateForm();
    } catch (error) {
      console.error(error);
      setCreateError("No se pudo completar la operacion de campana.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="mt-1 text-muted-foreground">
            Crear, segmentar por categoria y ubicacion, y enviar con plantillas
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate((value) => !value);
            setCreateError("");
            setCreateSuccess("");
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva campana
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
          <h2 className="font-semibold text-gray-900">Crear campana</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nombre</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Campana Barcelona abril"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Categoria de leads</label>
              <select
                value={selectedCategory}
                onChange={(event) => {
                  setSelectedCategory(event.target.value);
                  setLeads([]);
                  setSelectedLeadIds([]);
                  setPreviewData(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-700">
                {statsLoading ? (
                  <span>Cargando metricas de la categoria...</span>
                ) : (
                  <span>
                    Categoria: <strong>{selectedCategory}</strong> | leads: <strong>{categoryStats?.total ?? 0}</strong>{" "}
                    | con email: <strong className="text-emerald-700">{categoryStats?.withEmail ?? 0}</strong> | sin
                    email: <strong className="text-red-600">{categoryStats?.withoutEmail ?? 0}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchCategoryStats(selectedCategory)}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refrescar
                </button>
                <button
                  type="button"
                  disabled={enrichingEmails || (categoryStats?.enrichmentCandidates ?? 0) === 0}
                  onClick={() => void handleEnrichEmails("CATEGORY")}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-white disabled:opacity-50"
                >
                  {enrichingEmails ? "Encolando..." : "Enriquecer emails faltantes"}
                </button>
                <button
                  type="button"
                  disabled={enrichingEmails}
                  onClick={() => void handleEnrichEmails("ALL")}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-white disabled:opacity-50"
                >
                  {enrichingEmails ? "Encolando..." : "Enriquecer todas las categorias"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Candidatos a enriquecimiento web: {categoryStats?.enrichmentCandidates ?? 0}. Solo se intentan leads sin
              email y con website. Requiere worker activo (`npm run worker:start`).
            </p>
          </div>

          {enrichmentBatchId && (
            <div className="rounded-lg border bg-slate-950 p-3 text-green-300">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span>
                  batch {enrichmentBatchId} | scope {enrichmentScope}
                </span>
                <span>{enrichmentProgress?.isCompleted ? "COMPLETADO" : "EJECUTANDO"}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded bg-slate-700">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${enrichmentProgress?.progressPct ?? 0}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-green-200 md:grid-cols-4">
                <span>total: {enrichmentProgress?.total ?? 0}</span>
                <span>pending: {enrichmentProgress?.pending ?? 0}</span>
                <span>processing: {enrichmentProgress?.processing ?? 0}</span>
                <span>done: {enrichmentProgress?.done ?? 0}</span>
                <span>failed: {enrichmentProgress?.failed ?? 0}</span>
                <span>emails: {enrichmentProgress?.withEmail ?? 0}</span>
                <span>progress: {enrichmentProgress?.progressPct ?? 0}%</span>
              </div>
              <div
                ref={enrichmentConsoleRef}
                className="mt-2 h-40 overflow-auto rounded border border-slate-700 bg-slate-900 p-2 font-mono text-[11px] text-green-300"
              >
                {enrichmentConsoleLines.length === 0 && <div>$ esperando eventos de enriquecimiento...</div>}
                {enrichmentConsoleLines.map((line, index) => (
                  <div key={`${line}-${index}`}>$ {line}</div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Plantilla</label>
              <select
                value={selectedTemplateId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedTemplateId(nextId);
                  const template = filteredTemplates.find((item) => item.id === nextId);
                  if (template) setSubject(template.subjectTemplate);
                  setPreviewData(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {filteredTemplates.length === 0 && <option value="">Sin plantillas disponibles</option>}
                {filteredTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.category})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Asunto base</label>
              <input
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setPreviewData(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Asunto base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Contexto adicional (HTML opcional)</label>
            <textarea
              value={notesHtml}
              onChange={(event) => {
                setNotesHtml(event.target.value);
                setPreviewData(null);
              }}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="<p>Mensaje adicional para esta campana...</p>"
            />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium text-gray-800">Filtro por ubicacion</p>
            <div className="flex gap-2">
              <input
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Ej: Barcelona, Madrid, Valencia..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleLocationSearch();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleLocationSearch()}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              >
                <Search className="h-4 w-4" />
                {locationLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>
            {locationResults.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-md border divide-y">
                {locationResults.map((item) => (
                  <button
                    key={`${item.lat}-${item.lng}-${item.label}`}
                    type="button"
                    onClick={() => {
                      setLocationCenter({ lat: item.lat, lng: item.lng });
                      setLocationResults([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {locationCenter && (
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {locationCenter.lat.toFixed(4)}, {locationCenter.lng.toFixed(4)}
                </div>
                <input
                  type="number"
                  min="1"
                  max="200"
                  step="1"
                  value={locationRadiusKm}
                  onChange={(event) => setLocationRadiusKm(Number(event.target.value || "5"))}
                  className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
                <span className="text-xs text-muted-foreground">km</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocationCenter(null);
                    setLocationQuery("");
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchLeadsByCategory(selectedCategory)}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Users className="h-4 w-4" />
              {loadingLeads ? "Cargando leads..." : "Cargar leads por categoria"}
            </button>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={useAiPersonalization}
                onChange={(event) => setUseAiPersonalization(event.target.checked)}
              />
              Personalizacion IA por lead
            </label>
          </div>

          {leads.length > 0 && (
            <div className="rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                <p className="text-sm font-medium text-gray-700">
                  Leads: {leads.length} | en radio: {leadsByLocation.length} | visibles: {visibleLeads.length} |
                  con email: {loadedLeadsWithEmail} | sin email: {Math.max(0, leads.length - loadedLeadsWithEmail)} |
                  seleccionados: {selectedLeadIds.length} | enviables: {sendableLeadsInView.length}
                </p>
                <button
                  type="button"
                  onClick={toggleAllLeads}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {selectedLeadIds.length === sendableLeadsInView.length
                    ? "Deseleccionar todos"
                    : "Seleccionar todos con email"}
                </button>
              </div>
              {locationFilterBlocking && (
                <div className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  El filtro de ubicacion dejo 0 resultados en el radio actual. Mostrando todos los leads cargados.
                  <button
                    type="button"
                    onClick={() => setLocationCenter(null)}
                    className="ml-2 font-medium underline"
                  >
                    Quitar filtro de ubicacion
                  </button>
                </div>
              )}
              <div className="max-h-60 overflow-auto divide-y">
                {visibleLeads.map((lead) => {
                  const disabled = !hasValidEmail(lead.email);
                  return (
                  <label
                    key={lead.id}
                    className={`flex items-center gap-3 px-3 py-2 text-sm ${disabled ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      disabled={disabled}
                      onChange={() => toggleLead(lead.id, hasValidEmail(lead.email))}
                    />
                    <span className="font-medium">{lead.name}</span>
                    <span className="text-xs text-muted-foreground">{lead.segment}</span>
                    <span className="text-xs text-muted-foreground">score {lead.leadScore}</span>
                    <span className="text-xs text-muted-foreground truncate">{lead.address}</span>
                    {hasValidEmail(lead.email) ? (
                      <span className="text-xs text-emerald-700">con email</span>
                    ) : (
                      <span className="text-xs text-red-600">sin email (no enviable)</span>
                    )}
                  </label>
                )})}
                {visibleLeads.length === 0 && (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    No hay leads en el radio seleccionado.
                  </div>
                )}
              </div>
            </div>
          )}

          {leads.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Debes seleccionar al menos un lead con email para poder enviar.
            </p>
          )}

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-800">Preview de plantilla</p>
              <div className="flex items-center gap-2">
                <select
                  value={previewLeadId}
                  onChange={(event) => setPreviewLeadId(event.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  {visibleLeads.length === 0 && <option value="">Lead ejemplo</option>}
                  {visibleLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void generatePreview()}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {previewLoading ? "Generando..." : "Ver preview"}
                </button>
              </div>
            </div>
            {previewError && <p className="text-sm text-red-600">{previewError}</p>}
            {previewData && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Lead sample: {previewData.sampleLead.name} ({previewData.sampleLead.segment}) | IA:{" "}
                  {previewData.aiPersonalized ? "si" : "no"}
                </div>
                <div className="text-sm font-medium text-gray-800">Asunto: {previewData.subject}</div>
                <iframe
                  title="template-preview"
                  srcDoc={previewData.html}
                  className="h-72 w-full rounded-md border bg-white"
                />
              </div>
            )}
          </div>

          {createError && <p className="text-sm text-red-600">{createError}</p>}
          {createSuccess && <p className="text-sm text-green-600">{createSuccess}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleCreateAndSend}
              disabled={creating || !name.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
              {creating ? "Procesando..." : "Crear y enviar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 rounded-xl border bg-white">
          <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-gray-900">No hay campanas aun</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Crea tu primera campana por categoria y ubicacion
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const status = statusLabels[campaign.status] ?? statusLabels.DRAFT;
            return (
              <div key={campaign.id} className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="truncate font-medium text-gray-900">{campaign.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{campaign.subject}</p>
                <p className="mt-2 text-xs text-muted-foreground">
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
