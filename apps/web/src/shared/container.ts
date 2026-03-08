import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/PrismaLeadRepository";
import { SerperSearchProvider } from "@/modules/leads/infrastructure/SerperSearchProvider";
import { LeadAnalyzer } from "@/modules/leads/infrastructure/LeadAnalyzer";
import { PrismaCampaignRepository } from "@/modules/campaigns/infrastructure/PrismaCampaignRepository";
import { ResendEmailProvider } from "@/modules/campaigns/infrastructure/ResendEmailProvider";

// Leads module
container.register("ILeadRepository", { useClass: PrismaLeadRepository });
container.register("ISearchProvider", { useClass: SerperSearchProvider });
container.register("ILeadAnalyzer", { useClass: LeadAnalyzer });

// Campaigns module
container.register("ICampaignRepository", { useClass: PrismaCampaignRepository });
container.register("IEmailProvider", { useClass: ResendEmailProvider });

export { container };
