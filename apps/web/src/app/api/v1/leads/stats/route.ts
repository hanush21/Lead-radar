import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;

    const whereBase = {
      userId: session.user.id,
      ...(category ? { category } : {}),
    };

    const [total, withEmail, enrichmentCandidates] = await Promise.all([
      prisma.lead.count({ where: whereBase }),
      prisma.lead.count({
        where: {
          ...whereBase,
          email: { not: null },
          NOT: [{ email: "" }, { email: " " }],
        },
      }),
      prisma.lead.count({
        where: {
          ...whereBase,
          OR: [{ email: null }, { email: "" }, { email: " " }],
          website: { not: null },
          NOT: [{ website: "" }, { website: " " }],
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        category: category ?? null,
        total,
        withEmail,
        withoutEmail: Math.max(0, total - withEmail),
        enrichmentCandidates,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
