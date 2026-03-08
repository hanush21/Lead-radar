import type { Opportunity } from "../domain/entities/Lead";
import { categoryNeedsBooking } from "../domain/value-objects/BusinessCategory";
import type { ILeadAnalyzer } from "../application/use-cases/SearchLeadsUseCase";

interface AnalyzableData {
  website: string | null;
  hasBookingSystem: boolean;
  hasOnlinePayment: boolean;
  category: string;
}

export class LeadAnalyzer implements ILeadAnalyzer {
  analyze(data: AnalyzableData): Opportunity[] {
    const opportunities: Opportunity[] = [];

    if (!data.website) {
      opportunities.push({
        type: "NO_WEBSITE",
        label: "Sin página web",
        description: "Esta empresa no tiene presencia web. Es una gran oportunidad para ofrecer una landing page o web corporativa.",
        suggestedService: "Landing page / Web corporativa",
      });
    }

    if (!data.hasBookingSystem && categoryNeedsBooking(data.category)) {
      opportunities.push({
        type: "NO_BOOKING",
        label: "Sin sistema de citas",
        description: "No dispone de sistema de reservas online. Un sistema de citas mejoraría su eficiencia.",
        suggestedService: "App de reservas / Sistema de citas",
      });
    }

    if (!data.hasOnlinePayment) {
      opportunities.push({
        type: "NO_PAYMENT",
        label: "Sin pagos online",
        description: "No acepta pagos online. Implementar una pasarela de pago aumentaría sus ventas.",
        suggestedService: "Pasarela de pago / E-commerce",
      });
    }

    return opportunities;
  }
}
