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

function buildForgotPasswordSuccessResponse() {
  return NextResponse.json({
    data: {
      ok: true,
      message: "Si existe una cuenta con ese email, recibira un enlace de recuperacion.",
    },
  });
}

export async function POST(request: NextRequest) {
  let email: string | undefined;

  try {
    const body = await request.json();
    const parsed = ForgotPasswordSchema.parse(body);
    email = parsed.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return buildForgotPasswordSuccessResponse();
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

    if (!process.env.RESEND_API_KEY) {
      console.error("Password reset email skipped: RESEND_API_KEY is not configured", {
        email,
      });
      await prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      });
      return buildForgotPasswordSuccessResponse();
    }

    try {
      const emailService = new AuthEmailService();
      await emailService.sendPasswordResetEmail({
        name: user.name || "equipo",
        email: user.email,
        resetUrl,
        expiresInMinutes: getPasswordResetTtlMinutes(),
      });
    } catch (error) {
      console.error("Failed to send password reset email", {
        email,
        appBaseUrl,
        hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
      });
      console.error(error);

      try {
        await prisma.passwordResetToken.deleteMany({
          where: { tokenHash },
        });
      } catch (cleanupError) {
        console.error("Failed to cleanup password reset token after email error", {
          email,
          tokenHash,
        });
        console.error(cleanupError);
      }
    }

    return buildForgotPasswordSuccessResponse();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(error);
    }

    console.error("Forgot password request failed", { email });
    console.error(error);
    return buildForgotPasswordSuccessResponse();
  }
}
