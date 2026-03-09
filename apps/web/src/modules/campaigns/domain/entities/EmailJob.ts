export type EmailStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "COMPLAINED"
  | "UNSUBSCRIBED"
  | "FAILED";

export interface EmailJob {
  id: string;
  leadId: string;
  campaignId: string;
  status: EmailStatus;
  provider: string;
  resendId: string | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  unsubscribedAt: Date | null;
  convertedAt: Date | null;
  conversionSource: string | null;
  renderedSubject: string | null;
  renderedHtml: string | null;
  aiPersonalized: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
}
