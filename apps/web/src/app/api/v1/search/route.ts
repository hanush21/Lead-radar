import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { SearchLeadsDtoSchema } from "@/modules/leads/application/dtos/SearchLeadsDto";
import { SearchLeadsUseCase } from "@/modules/leads/application/use-cases/SearchLeadsUseCase";
import { SerperSearchProvider } from "@/modules/leads/infrastructure/SerperSearchProvider";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { LeadAnalyzer } from "@/modules/leads/infrastructure/LeadAnalyzer";
import { toLeadResponseDto } from "@/modules/leads/application/dtos/LeadResponseDto";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const dto = SearchLeadsDtoSchema.parse(body);

    const useCase = new SearchLeadsUseCase(
      new SerperSearchProvider(),
      new PrismaLeadRepository(),
      new LeadAnalyzer()
    );

    const leads = await useCase.execute(dto, session.user.id);

    return NextResponse.json({
      data: leads.map(toLeadResponseDto),
      meta: { total: leads.length },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
