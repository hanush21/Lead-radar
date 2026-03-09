import { NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const userId = session.user.id;

    const [
      totalLeads,
      leadsByStatus,
      totalCampaigns,
      emailsSent,
      emailsDelivered,
      emailsOpened,
      emailsClicked,
      emailsConverted,
      emailStats,
    ] =
      await Promise.all([
        prisma.lead.count({ where: { userId } }),
        prisma.lead.groupBy({
          by: ["status"],
          where: { userId },
          _count: { _all: true },
        }),
        prisma.campaign.count({ where: { userId } }),
        prisma.emailJob.count({
          where: { campaign: { userId }, sentAt: { not: null } },
        }),
        prisma.emailJob.count({
          where: { campaign: { userId }, deliveredAt: { not: null } },
        }),
        prisma.emailJob.count({
          where: { campaign: { userId }, openedAt: { not: null } },
        }),
        prisma.emailJob.count({
          where: { campaign: { userId }, clickedAt: { not: null } },
        }),
        prisma.emailJob.count({
          where: { campaign: { userId }, convertedAt: { not: null } },
        }),
        prisma.emailJob.groupBy({
          by: ["status"],
          where: { campaign: { userId } },
          _count: { _all: true },
        }),
      ]);

    const statusMap: Record<string, number> = Object.fromEntries(
      leadsByStatus.map((s) => [s.status, s._count._all])
    );
    const emailMap: Record<string, number> = Object.fromEntries(
      emailStats.map((s) => [s.status, s._count._all])
    );

    return NextResponse.json({
      data: {
        totalLeads,
        leadsByStatus: statusMap,
        totalCampaigns,
        emailsSent,
        emailsDelivered,
        emailsOpened,
        emailsClicked,
        emailsConverted,
        openRate: emailsDelivered > 0 ? (emailsOpened / emailsDelivered) * 100 : 0,
        clickRate: emailsDelivered > 0 ? (emailsClicked / emailsDelivered) * 100 : 0,
        ctor: emailsOpened > 0 ? (emailsClicked / emailsOpened) * 100 : 0,
        emailConversionRate: emailsDelivered > 0 ? (emailsConverted / emailsDelivered) * 100 : 0,
        conversionRate:
          totalLeads > 0
            ? ((statusMap.CONVERTED ?? 0) / totalLeads) * 100
            : 0,
        emailStatusMap: emailMap,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
