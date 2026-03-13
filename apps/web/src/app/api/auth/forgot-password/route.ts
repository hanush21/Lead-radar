import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";
import {
  createPasswordResetToken,
  getPasswordResetExpiry,
  getPasswordResetTtlMinutes,
  resolveAppBaseUrl,
} from "@/modules/auth/infrastructure/passwordReset";
import { AuthEmailService } from "@/modules/auth/infrastructure/email/AuthEmailService";

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ForgotPasswordSchema.parse(body);
    const email = parsed.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({
        data: {
          ok: true,
          message: "Si existe una cuenta con ese email, recibira un enlace de recuperacion.",
        },
      });
    }

    const { rawToken, tokenHash } = createPasswordResetToken();
    const expiresAt = getPasswordResetExpiry();
    const appBaseUrl = resolveAppBaseUrl(request.nextUrl.origin);
    const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    try {
      const emailService = new AuthEmailService();
      await emailService.sendPasswordResetEmail({
        name: user.name || "equipo",
        email: user.email,
        resetUrl,
        expiresInMinutes: getPasswordResetTtlMinutes(),
      });
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      });
      console.error("Failed to send password reset email", error);
    }

    return NextResponse.json({
      data: {
        ok: true,
        message: "Si existe una cuenta con ese email, recibira un enlace de recuperacion.",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
