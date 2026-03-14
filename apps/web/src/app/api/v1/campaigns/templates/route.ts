import { NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const repository = new PrismaCampaignRepository();
    await repository.ensureDefaultTemplates();
    const templates = await repository.listActiveTemplates();

    return NextResponse.json({ data: templates });
  } catch (error) {
    return handleApiError(error);
  }
}
