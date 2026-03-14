import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/shared/lib/prisma";
import { handleApiError } from "@/shared/errors/HttpError";

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RegisterSchema.parse(body);
    const name = parsed.name.trim();
    const email = parsed.email.trim().toLowerCase();
    const password = parsed.password;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "El email ya está registrado" } },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    return NextResponse.json(
      { data: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
