import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { SearchLeadsDtoSchema } from "@/modules/leads/application/dtos/SearchLeadsDto";
import { SearchLeadsUseCase } from "@/modules/leads/application/use-cases/SearchLeadsUseCase";
import { SerperSearchProvider } from "@/modules/leads/infrastructure/SerperSearchProvider";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { LeadAnalyzer } from "@/modules/leads/infrastructure/LeadAnalyzer";
import { PgBossLeadProcessingQueue } from "@/modules/leads/infrastructure/queue/LeadProcessingQueue";
import { toLeadResponseDto } from "@/modules/leads/application/dtos/LeadResponseDto";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";
import { rateLimit } from "@/shared/lib/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const limiter = rateLimit(`search:${session.user.id}:${requestIp}`, {
      maxRequests: 30,
      windowMs: 5 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many search requests. Please try again in a few minutes.",
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const dto = SearchLeadsDtoSchema.parse(body);

    const useCase = new SearchLeadsUseCase(
      new SerperSearchProvider(),
      new PrismaLeadRepository(),
      new LeadAnalyzer(),
      new PgBossLeadProcessingQueue()
    );

    const result = await useCase.execute(dto, session.user.id);

    console.info("Lead search completed", {
      userId: session.user.id,
      fetched: result.meta.fetched,
      insideRadius: result.meta.insideRadius,
      dedupedInMemory: result.meta.dedupedInMemory,
      created: result.meta.created,
      updated: result.meta.updated,
      deduped: result.meta.deduped,
      persisted: result.meta.persisted,
      queuedForEnrichment: result.meta.queuedForEnrichment,
    });

    return NextResponse.json({
      data: result.leads.map(toLeadResponseDto),
      meta: {
        total: result.leads.length,
        fetched: result.meta.fetched,
        insideRadius: result.meta.insideRadius,
        dedupedInMemory: result.meta.dedupedInMemory,
        created: result.meta.created,
        updated: result.meta.updated,
        deduped: result.meta.deduped,
        queuedForEnrichment: result.meta.queuedForEnrichment,
        persisted: result.meta.persisted,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
