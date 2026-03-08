import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth/infrastructure/NextAuthAdapter";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { GetLeadByIdUseCase } from "@/modules/leads/application/use-cases/GetLeadByIdUseCase";
import { toLeadResponseDto } from "@/modules/leads/application/dtos/LeadResponseDto";
import { handleApiError } from "@/shared/errors/HttpError";
import { UnauthorizedError } from "@/shared/errors/AppError";

const repo = new PrismaLeadRepository();

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const useCase = new GetLeadByIdUseCase(repo);
    const lead = await useCase.execute(params.id, session.user.id);

    return NextResponse.json({ data: toLeadResponseDto(lead) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();

    const existing = await repo.findById(params.id);
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }

    const updated = await repo.update(params.id, body);
    return NextResponse.json({ data: toLeadResponseDto(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const existing = await repo.findById(params.id);
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }

    await repo.delete(params.id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
