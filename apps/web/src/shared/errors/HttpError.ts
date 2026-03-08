import { NextResponse } from "next/server";
import { AppError } from "./AppError";
import { ZodError } from "zod";

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    { status: 500 }
  );
}
