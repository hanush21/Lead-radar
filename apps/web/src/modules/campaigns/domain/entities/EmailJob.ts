export type EmailStatus = "QUEUED" | "SENT" | "OPENED" | "CLICKED" | "BOUNCED" | "FAILED";

export interface EmailJob {
  id: string;
  leadId: string;
  campaignId: string;
  status: EmailStatus;
  resendId: string | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}
