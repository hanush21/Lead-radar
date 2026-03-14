import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { UnauthorizedError } from "@/shared/errors/AppError";
import { handleApiError } from "@/shared/errors/HttpError";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { CampaignEmailComposer } from "@/modules/campaigns/infrastructure/email/CampaignEmailComposer";
import { DeepSeekLeadPersonalizer } from "@/modules/campaigns/infrastructure/ai/DeepSeekLeadPersonalizer";
import type { Lead } from "@/modules/leads/domain/entities/Lead";

const PreviewSchema = z.object({
  templateId: z.string().optional(),
  leadId: z.string().optional(),
  category: z.string().min(1),
  campaignName: z.string().min(1).default("Preview Campaign"),
  subject: z.string().optional().default("Preview Subject"),
  body: z.string().optional().default(""),
  useAiPersonalization: z.boolean().optional().default(false),
});

function buildMockLead(userId: string, category: string): Lead {
  const now = new Date();
  return {
    id: "preview-lead",
    name: "Negocio de ejemplo",
    category,
    address: "Calle Mayor 1, Madrid",
    lat: 40.4168,
    lng: -3.7038,
    phone: null,
    email: "contacto@negocio-ejemplo.com",
    website: null,
    rating: 4.1,
    reviewCount: 32,
    hasBookingSystem: false,
    hasOnlinePayment: false,
    status: "NEW",
    provider: "preview",
    providerPlaceId: null,
    dedupeKey: "preview",
    leadScore: 62,
    enrichmentStatus: "DONE",
    segment: "WARM",
    tags: ["NO_BOOKING", "NO_PAYMENT"],
    opportunities: [],
    sourceQuery: "preview",
    userId,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const dto = PreviewSchema.parse(body);

    const campaignRepository = new PrismaCampaignRepository();
    const leadRepository = new PrismaLeadRepository();
    const composer = new CampaignEmailComposer(campaignRepository, new DeepSeekLeadPersonalizer());

    let lead: Lead | null = null;
    if (dto.leadId) {
      const candidate = await leadRepository.findById(dto.leadId);
      if (candidate && candidate.userId === session.user.id) lead = candidate;
    }

    if (!lead) {
      const found = await leadRepository.findAll({
        userId: session.user.id,
        category: dto.category,
        page: 1,
        pageSize: 1,
      });
      lead = found.leads[0] ?? null;
    }

    const sampleLead = lead ?? buildMockLead(session.user.id, dto.category);
    const composed = await composer.compose(
      {
        id: "preview-campaign",
        name: dto.campaignName,
        subject: dto.subject,
        body: dto.body,
        status: "DRAFT",
        userId: session.user.id,
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      sampleLead,
      {
        templateId: dto.templateId,
        useAiPersonalization: dto.useAiPersonalization,
      }
    );

    return NextResponse.json({
      data: {
        ...composed,
        sampleLead: {
          id: sampleLead.id,
          name: sampleLead.name,
          category: sampleLead.category,
          segment: sampleLead.segment,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
