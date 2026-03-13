import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";
import { ValidationError } from "@/shared/errors/AppError";
import { hashPasswordResetToken } from "@/modules/auth/infrastructure/passwordReset";

const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResetPasswordSchema.parse(body);
    const tokenHash = hashPasswordResetToken(parsed.token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new ValidationError("El enlace de recuperacion no es valido o ha caducado");
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        ok: true,
        message: "Contrasena actualizada correctamente",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
