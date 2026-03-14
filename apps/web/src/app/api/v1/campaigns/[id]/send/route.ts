import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { SendCampaignUseCase } from "@/modules/campaigns/application/use-cases/SendCampaignUseCase";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { ResendEmailProvider } from "@/modules/campaigns/infrastructure/ResendEmailProvider";
import { CampaignEmailComposer } from "@/modules/campaigns/infrastructure/email/CampaignEmailComposer";
import { DeepSeekLeadPersonalizer } from "@/modules/campaigns/infrastructure/ai/DeepSeekLeadPersonalizer";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

const SendCampaignSchema = z.object({
  leadIds: z.array(z.string()).min(1),
  templateId: z.string().optional(),
  useAiPersonalization: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const { leadIds, templateId, useAiPersonalization } = SendCampaignSchema.parse(body);

    const campaignRepository = new PrismaCampaignRepository();

    const useCase = new SendCampaignUseCase(
      campaignRepository,
      new PrismaLeadRepository(),
      new ResendEmailProvider(),
      new CampaignEmailComposer(campaignRepository, new DeepSeekLeadPersonalizer())
    );

    const results = await useCase.execute(params.id, leadIds, session.user.id, {
      templateId,
      useAiPersonalization,
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    return handleApiError(error);
  }
}
