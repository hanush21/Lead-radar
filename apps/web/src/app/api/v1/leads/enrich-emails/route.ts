import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";
import { PgBossLeadProcessingQueue } from "@/modules/leads/infrastructure/queue/LeadProcessingQueue";

const EnrichEmailsSchema = z.object({
  category: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(1000).default(300),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json().catch(() => ({}));
    const dto = EnrichEmailsSchema.parse(body);

    const where = {
      userId: session.user.id,
      ...(dto.category ? { category: dto.category } : {}),
      OR: [{ email: null }, { email: "" }, { email: " " }],
      website: { not: null },
      NOT: [{ website: "" }, { website: " " }],
    };

    const leads = await prisma.lead.findMany({
      where,
      select: { id: true },
      take: dto.limit,
      orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
    });

    const queue = new PgBossLeadProcessingQueue();
    let queued = 0;

    for (const lead of leads) {
      const ok = await queue.enqueueRecheck({
        leadId: lead.id,
        userId: session.user.id,
      });
      if (ok) queued += 1;
    }

    return NextResponse.json({
      data: {
        category: dto.category ?? null,
        candidates: leads.length,
        queued,
        skipped: Math.max(0, leads.length - queued),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
