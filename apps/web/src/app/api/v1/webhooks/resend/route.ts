import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { handleApiError } from "@/shared/errors/HttpError";

type SupportedEvent =
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "COMPLAINED"
  | "UNSUBSCRIBED";

const EVENT_MAP: Record<string, SupportedEvent> = {
  sent: "SENT",
  delivered: "DELIVERED",
  opened: "OPENED",
  clicked: "CLICKED",
  bounced: "BOUNCED",
  complained: "COMPLAINED",
  unsubscribed: "UNSUBSCRIBED",
};

function toSupportedEvent(raw: string): SupportedEvent | null {
  const normalized = raw.trim().toLowerCase().replace("email.", "");
  return EVENT_MAP[normalized] ?? null;
}

function extractResendId(event: any): string | null {
  const id =
    event?.data?.email_id ??
    event?.data?.id ??
    event?.data?.email?.id ??
    event?.data?.object?.id ??
    null;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function parseOccurredAt(event: any): Date {
  const raw = event?.created_at ?? event?.data?.created_at ?? null;
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function verifyWebhookPayload(request: NextRequest, rawBody: string) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured");
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, reason: "MISSING_SIGNATURE_HEADERS" };
  }

  try {
    const webhook = new Webhook(secret);
    webhook.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    return { valid: true, svixId };
  } catch {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const verification = verifyWebhookPayload(request, rawBody);

    if (!verification.valid) {
      const status = verification.reason === "INVALID_SIGNATURE" ? 401 : 400;
      return NextResponse.json(
        { error: { code: verification.reason, message: "Invalid webhook signature" } },
        { status }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = toSupportedEvent(String(event?.type ?? ""));
    if (!eventType) {
      return NextResponse.json({ data: { ignored: true } });
    }

    const resendId = extractResendId(event);
    if (!resendId) {
      return NextResponse.json({ data: { ignored: true, reason: "MISSING_RESEND_ID" } });
    }

    const repository = new PrismaCampaignRepository();
    const emailJob = await repository.findEmailJobByResendId(resendId);
    if (!emailJob) {
      return NextResponse.json({ data: { ignored: true, reason: "EMAIL_JOB_NOT_FOUND" } });
    }

    const providerEventId = verification.svixId ?? `${resendId}:${eventType}:${event?.created_at ?? Date.now()}`;
    const result = await repository.recordEmailEvent({
      emailJobId: emailJob.id,
      providerEventId,
      resendId,
      eventType,
      occurredAt: parseOccurredAt(event),
      payload: event,
    });

    return NextResponse.json({ data: { processed: true, deduped: !result.created } });
  } catch (error) {
    return handleApiError(error);
  }
}
