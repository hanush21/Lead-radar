import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";
import { PgBossLeadProcessingQueue } from "@/modules/leads/infrastructure/queue/LeadProcessingQueue";
import { randomUUID } from "crypto";

const EnrichEmailsSchema = z.object({
  category: z.string().min(1).optional(),
  allCategories: z.boolean().default(false),
  limit: z.number().int().min(1).max(1000).default(300),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json().catch(() => ({}));
    const dto = EnrichEmailsSchema.parse(body);
    const scope: "ALL" | "CATEGORY" = dto.allCategories ? "ALL" : "CATEGORY";
    if (scope === "CATEGORY" && !dto.category) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "category is required for CATEGORY scope" } },
        { status: 400 }
      );
    }

    const where = {
      userId: session.user.id,
      ...(scope === "CATEGORY" && dto.category ? { category: dto.category } : {}),
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

    if (leads.length === 0) {
      return NextResponse.json({
        data: {
          batchId: null,
          scope,
          category: scope === "CATEGORY" ? dto.category ?? null : null,
          candidates: 0,
          queued: 0,
          skipped: 0,
        },
      });
    }

    const batchId = randomUUID();

    const queue = new PgBossLeadProcessingQueue();
    let queued = 0;
    const queuedIds: string[] = [];
    const now = new Date();

    if (leads.length > 0) {
      await prisma.lead.updateMany({
        where: {
          userId: session.user.id,
          id: { in: leads.map((lead: { id: string }) => lead.id) },
        },
        data: {
          enrichmentBatchId: batchId,
          enrichmentRequestedAt: now,
          enrichmentCompletedAt: null,
          enrichmentStatus: "PENDING",
        },
      });
    }

    for (const lead of leads) {
      const ok = await queue.enqueueRecheck({
        leadId: lead.id,
        userId: session.user.id,
        batchId,
      });
      if (ok) {
        queued += 1;
        queuedIds.push(lead.id);
      }
    }

    if (queued < leads.length) {
      const skippedIds = leads
        .map((lead: { id: string }) => lead.id)
        .filter((id: string) => !queuedIds.includes(id));
      if (skippedIds.length > 0) {
        await prisma.lead.updateMany({
          where: {
            userId: session.user.id,
            id: { in: skippedIds },
          },
          data: {
            enrichmentStatus: "FAILED",
            enrichmentCompletedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      data: {
        batchId,
        scope,
        category: scope === "CATEGORY" ? dto.category ?? null : null,
        candidates: leads.length,
        queued,
        skipped: Math.max(0, leads.length - queued),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
