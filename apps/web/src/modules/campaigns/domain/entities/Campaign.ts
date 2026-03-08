export type CampaignStatus = "DRAFT" | "SENDING" | "SENT" | "PAUSED";

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  userId: string;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  body: string;
  userId: string;
}
