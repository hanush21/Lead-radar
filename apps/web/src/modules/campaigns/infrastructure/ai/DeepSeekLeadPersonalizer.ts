import { z } from "zod";

export interface AiPersonalizationRequest {
  businessName: string;
  categoryLabel: string;
  city: string;
  leadSummary: string;
  baseSubject: string;
  baseIntro: string;
  baseBody: string;
  baseCtaLabel: string;
}

export interface AiPersonalizationResult {
  subject?: string;
  intro?: string;
  body?: string;
  ctaLabel?: string;
}

const AiSchema = z.object({
  subject: z.string().min(5).max(160).optional(),
  intro: z.string().min(10).max(320).optional(),
  body: z.string().min(10).max(700).optional(),
  ctaLabel: z.string().min(2).max(80).optional(),
});

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("No JSON object found");
}

export class DeepSeekLeadPersonalizer {
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.apiKey = process.env.AI_API_KEY ?? null;
    this.model = process.env.AI_MODEL ?? "deepseek-chat";
    this.baseUrl = (process.env.AI_BASE_URL ?? "https://api.deepseek.com/v1").replace(/\/+$/, "");
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? "8000");
  }

  isEnabled() {
    return Boolean(this.apiKey);
  }

  async personalize(input: AiPersonalizationRequest): Promise<AiPersonalizationResult | null> {
    if (!this.apiKey) return null;

    const systemPrompt =
      "Eres un copywriter B2B de captacion local. Devuelve SOLO JSON valido con subject, intro, body, ctaLabel.";
    const userPrompt = [
      `Negocio: ${input.businessName}`,
      `Categoria: ${input.categoryLabel}`,
      `Ciudad: ${input.city}`,
      `Resumen lead: ${input.leadSummary}`,
      `Base subject: ${input.baseSubject}`,
      `Base intro: ${input.baseIntro}`,
      `Base body: ${input.baseBody}`,
      `Base cta: ${input.baseCtaLabel}`,
      "Reglas: espanol profesional, concreto, sin promesas irreales, maximo 1 frase por campo.",
    ].join("\n");

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!response.ok) return null;

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") return null;

      const parsed = extractJsonObject(content);
      const validated = AiSchema.safeParse(parsed);
      if (!validated.success) return null;

      return validated.data;
    } catch {
      return null;
    }
  }
}
