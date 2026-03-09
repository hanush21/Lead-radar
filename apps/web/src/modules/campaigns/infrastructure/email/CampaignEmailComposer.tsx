import { render } from "@react-email/render";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { Campaign } from "../../domain/entities/Campaign";
import type { Lead } from "@/modules/leads/domain/entities/Lead";
import type { ICampaignRepository } from "../../domain/repositories/ICampaignRepository";
import { getCategoryLabel } from "@/modules/leads/domain/value-objects/BusinessCategory";
import type {
  AiPersonalizationResult,
  DeepSeekLeadPersonalizer,
} from "../ai/DeepSeekLeadPersonalizer";

interface TemplateLike {
  id: string;
  subjectTemplate: string;
  headlineTemplate: string;
  introTemplate: string;
  bodyTemplate: string;
  ctaLabelTemplate: string;
  ctaUrlTemplate: string;
  signatureTemplate: string;
}

interface ComposeOptions {
  templateId?: string;
  useAiPersonalization?: boolean;
}

export interface ComposedEmail {
  subject: string;
  html: string;
  aiPersonalized: boolean;
  templateId: string | null;
}

const FALLBACK_TEMPLATE: TemplateLike = {
  id: "fallback",
  subjectTemplate: "{{businessName}}: propuesta para mejorar captacion local",
  headlineTemplate: "Hola {{businessName}}",
  introTemplate: "Detectamos oportunidades de mejora para {{categoryLabel}} en {{city}}.",
  bodyTemplate:
    "Podemos ayudarte a convertir mas visitas en clientes con una propuesta concreta y medible.",
  ctaLabelTemplate: "Ver propuesta",
  ctaUrlTemplate: "https://leadradar.local/propuesta?lead={{leadId}}",
  signatureTemplate: "Equipo LeadRadar",
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => vars[key] ?? "");
}

function inferCity(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const withLetters = parts.filter((part) => /[a-zA-ZÀ-ÿ]/.test(part));
  if (withLetters.length > 0) {
    return withLetters[withLetters.length - 1];
  }

  if (parts.length > 0) return parts[parts.length - 1];
  return "tu zona";
}

function buildLeadSummary(lead: Lead): string {
  const tags = [
    !lead.website ? "sin_web" : "con_web",
    lead.hasBookingSystem ? "con_reservas" : "sin_reservas",
    lead.hasOnlinePayment ? "con_pago_online" : "sin_pago_online",
    lead.rating != null ? `rating_${lead.rating}` : "sin_rating",
    `reviews_${lead.reviewCount}`,
    `score_${lead.leadScore}`,
    `segment_${lead.segment}`,
  ];
  return tags.join(", ");
}

function buildDiagnosticSummary(lead: Lead): string {
  const findings: string[] = [];
  if (!lead.website) findings.push("no se detecta web corporativa clara");
  if (!lead.email) findings.push("no hay canal email visible para captacion");
  if (!lead.hasBookingSystem) findings.push("no hay sistema de reservas online");
  if (!lead.hasOnlinePayment) findings.push("no hay pagos online visibles");
  if (lead.rating != null && lead.rating < 4.0) findings.push("rating mejorable frente a competencia local");
  if (lead.reviewCount < 20) findings.push("baja prueba social en volumen de resenas");
  if (findings.length === 0) findings.push("hay margen en automatizacion de captacion y seguimiento comercial");
  return findings.join("; ");
}

function getReplyEmail() {
  return process.env.RESEND_REPLY_TO ?? "hera.contactanos@gmail.com";
}

async function renderEmailHtml(input: {
  preview: string;
  headline: string;
  intro: string;
  body: string;
  signature: string;
}) {
  return render(
    <Html lang="es">
      <Head />
      <Preview>{input.preview}</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f3f4f6", margin: 0 }}>
        <Container
          style={{
            maxWidth: "640px",
            margin: "24px auto",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "28px",
          }}
        >
          <Heading as="h1" style={{ color: "#111827", fontSize: "24px", margin: 0 }}>
            {input.headline}
          </Heading>
          <Section style={{ marginTop: "18px" }}>
            <Text style={{ color: "#374151", fontSize: "16px", lineHeight: "24px" }}>{input.intro}</Text>
            <Text style={{ color: "#374151", fontSize: "16px", lineHeight: "24px" }}>{input.body}</Text>
          </Section>
          <Section style={{ marginTop: "22px" }}>
            <Text style={{ color: "#6b7280", fontSize: "14px", marginBottom: 0 }}>{input.signature}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function mergeAi(
  base: {
    subject: string;
    intro: string;
    body: string;
    ctaLabel: string;
  },
  ai: AiPersonalizationResult | null
) {
  if (!ai) return { ...base, personalized: false };
  return {
    subject: normalizeText(ai.subject || base.subject),
    intro: normalizeText(ai.intro || base.intro),
    body: normalizeText(ai.body || base.body),
    ctaLabel: normalizeText(ai.ctaLabel || base.ctaLabel),
    personalized: Boolean(ai.subject || ai.intro || ai.body || ai.ctaLabel),
  };
}

export class CampaignEmailComposer {
  constructor(
    private readonly campaignRepository: ICampaignRepository,
    private readonly personalizer?: DeepSeekLeadPersonalizer
  ) {}

  async compose(campaign: Campaign, lead: Lead, options: ComposeOptions = {}): Promise<ComposedEmail> {
    await this.campaignRepository.ensureDefaultTemplates();

    const template =
      (options.templateId ? await this.campaignRepository.findTemplateById(options.templateId) : null) ||
      (await this.campaignRepository.findDefaultTemplateByCategory(lead.category)) ||
      FALLBACK_TEMPLATE;

    const businessName = lead.name.trim();
    const categoryLabel = getCategoryLabel(lead.category);
    const city = inferCity(lead.address);
    const campaignNotes = stripHtml(campaign.body || "");
    const diagnosticSummary = buildDiagnosticSummary(lead);

    const variables = {
      businessName,
      categoryLabel,
      city,
      leadId: lead.id,
      campaignName: campaign.name,
      campaignNotes,
      diagnosticSummary,
      replyEmail: getReplyEmail(),
    };

    const subject = normalizeText(interpolate(template.subjectTemplate, variables));
    const headline = normalizeText(interpolate(template.headlineTemplate, variables));
    const intro = normalizeText(interpolate(template.introTemplate, variables));
    const body = normalizeText(
      `${interpolate(template.bodyTemplate, variables)}${campaignNotes ? ` ${campaignNotes}` : ""}`
    );
    const ctaLabel = normalizeText(interpolate(template.ctaLabelTemplate, variables));
    const signature = normalizeText(interpolate(template.signatureTemplate, variables));

    let aiResult: AiPersonalizationResult | null = null;
    if (options.useAiPersonalization !== false && this.personalizer?.isEnabled()) {
      aiResult = await this.personalizer.personalize({
        businessName,
        categoryLabel,
        city,
        leadSummary: buildLeadSummary(lead),
        baseSubject: subject,
        baseIntro: intro,
        baseBody: body,
        baseCtaLabel: ctaLabel,
      });
    }

    const merged = mergeAi(
      {
        subject,
        intro,
        body,
        ctaLabel,
      },
      aiResult
    );

    const html = await renderEmailHtml({
      preview: merged.subject,
      headline,
      intro: merged.intro,
      body: merged.body,
      signature,
    });

    return {
      subject: merged.subject,
      html,
      aiPersonalized: merged.personalized,
      templateId: template.id,
    };
  }
}
