import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { toLeadResponseDto } from "@/modules/leads/application/dtos/LeadResponseDto";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const category = searchParams.get("category") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const repo = new PrismaLeadRepository();
    const { leads, total } = await repo.findAll({
      userId: session.user.id,
      page,
      pageSize,
      category,
      status,
    });

    return NextResponse.json({
      data: leads.map(toLeadResponseDto),
      meta: { page, pageSize, total },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
