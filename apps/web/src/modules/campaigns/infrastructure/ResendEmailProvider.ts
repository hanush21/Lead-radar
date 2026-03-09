import { Resend } from "resend";
import type { IEmailProvider } from "../application/use-cases/SendCampaignUseCase";

export class ResendEmailProvider implements IEmailProvider {
  private readonly client: Resend;
  private readonly fromEmail: string;
  private readonly replyToEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
    this.client = new Resend(apiKey);
    this.fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@leadradar.com";
    this.replyToEmail = process.env.RESEND_REPLY_TO ?? "hera.contactanos@gmail.com";
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ resendId: string }> {
    const { data, error } = await this.client.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: this.replyToEmail,
    });

    if (error || !data) {
      throw new Error(`Resend error: ${error?.message ?? "Unknown error"}`);
    }

    return { resendId: data.id };
  }
}
