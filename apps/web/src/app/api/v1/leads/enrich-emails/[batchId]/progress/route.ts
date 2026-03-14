import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

export const dynamic = "force-dynamic";

type Params = { params: { batchId: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const batchId = String(params.batchId || "").trim();
    if (!batchId) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "batchId is required" } },
        { status: 400 }
      );
    }

    const whereBase = {
      userId: session.user.id,
      enrichmentBatchId: batchId,
    };

    const [summaryRows, recentLeads] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          total: number;
          pending: number;
          processing: number;
          done: number;
          failed: number;
          with_email: number;
        }>
      >`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "enrichmentStatus" = 'PENDING')::int AS pending,
          COUNT(*) FILTER (WHERE "enrichmentStatus" = 'PROCESSING')::int AS processing,
          COUNT(*) FILTER (WHERE "enrichmentStatus" = 'DONE')::int AS done,
          COUNT(*) FILTER (WHERE "enrichmentStatus" = 'FAILED')::int AS failed,
          COUNT(*) FILTER (WHERE email IS NOT NULL AND btrim(email) <> '')::int AS with_email
        FROM "Lead"
        WHERE "userId" = ${session.user.id}
          AND "enrichmentBatchId" = ${batchId};
      `,
      prisma.lead.findMany({
        where: {
          ...whereBase,
          enrichmentCompletedAt: { not: null },
        },
        orderBy: { enrichmentCompletedAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          email: true,
          enrichmentStatus: true,
          enrichmentCompletedAt: true,
        },
      }),
    ]);

    const summary = summaryRows[0] ?? {
      total: 0,
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
      with_email: 0,
    };
    const total = summary.total ?? 0;
    const pending = summary.pending ?? 0;
    const processing = summary.processing ?? 0;
    const done = summary.done ?? 0;
    const failed = summary.failed ?? 0;
    const withEmail = summary.with_email ?? 0;

    const completed = done + failed;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({
      data: {
        batchId,
        total,
        pending,
        processing,
        done,
        failed,
        completed,
        withEmail,
        progressPct,
        isCompleted: total > 0 && completed >= total,
        recentLeads: recentLeads.map(
          (lead: {
            id: string;
            name: string;
            email: string | null;
            enrichmentStatus: string;
            enrichmentCompletedAt: Date | null;
          }) => ({
          id: lead.id,
          name: lead.name,
          status: lead.enrichmentStatus,
          email: lead.email,
          completedAt: lead.enrichmentCompletedAt,
          })
        ),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
