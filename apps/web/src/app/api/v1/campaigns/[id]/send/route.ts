import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { SendCampaignUseCase } from "@/modules/campaigns/application/use-cases/SendCampaignUseCase";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { ResendEmailProvider } from "@/modules/campaigns/infrastructure/ResendEmailProvider";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

const SendCampaignSchema = z.object({
  leadIds: z.array(z.string()).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const { leadIds } = SendCampaignSchema.parse(body);

    const useCase = new SendCampaignUseCase(
      new PrismaCampaignRepository(),
      new PrismaLeadRepository(),
      new ResendEmailProvider()
    );

    const results = await useCase.execute(params.id, leadIds, session.user.id);

    return NextResponse.json({ data: results });
  } catch (error) {
    return handleApiError(error);
  }
}
