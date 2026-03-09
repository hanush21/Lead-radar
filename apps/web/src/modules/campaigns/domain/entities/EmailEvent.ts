export type EmailEventType =
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "COMPLAINED"
  | "UNSUBSCRIBED";

export interface EmailEvent {
  id: string;
  emailJobId: string;
  provider: string;
  providerEventId: string;
  resendId: string | null;
  eventType: EmailEventType;
  occurredAt: Date;
  payload: unknown;
  createdAt: Date;
}
