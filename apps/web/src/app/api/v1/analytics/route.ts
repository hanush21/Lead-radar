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

    const [totalLeads, leadsByStatus, totalCampaigns, emailStats] =
      await Promise.all([
        prisma.lead.count({ where: { userId } }),
        prisma.lead.groupBy({
          by: ["status"],
          where: { userId },
          _count: { _all: true },
        }),
        prisma.campaign.count({ where: { userId } }),
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
        emailsSent: emailMap.SENT ?? 0,
        emailsOpened: emailMap.OPENED ?? 0,
        emailsClicked: emailMap.CLICKED ?? 0,
        conversionRate:
          totalLeads > 0
            ? ((statusMap.CONVERTED ?? 0) / totalLeads) * 100
            : 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
