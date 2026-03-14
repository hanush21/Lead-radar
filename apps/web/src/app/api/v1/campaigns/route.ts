import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { CreateCampaignUseCase, CreateCampaignDtoSchema } from "@/modules/campaigns/application/use-cases/CreateCampaignUseCase";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

const repo = new PrismaCampaignRepository();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const dto = CreateCampaignDtoSchema.parse(body);

    const useCase = new CreateCampaignUseCase(repo);
    const campaign = await useCase.execute(dto, session.user.id);

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const campaigns = await repo.findAll(session.user.id);
    return NextResponse.json({ data: campaigns });
  } catch (error) {
    return handleApiError(error);
  }
}
