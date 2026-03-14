import { NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

const repo = new PrismaCampaignRepository();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const campaign = await repo.findById(params.id);
    if (!campaign || campaign.userId !== session.user.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Campaign not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: campaign });
  } catch (error) {
    return handleApiError(error);
  }
}
