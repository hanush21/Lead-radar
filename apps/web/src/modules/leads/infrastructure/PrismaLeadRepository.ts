import { prisma } from "@/shared/lib/prisma";
import type { Lead, CreateLeadInput } from "../domain/entities/Lead";
import type { ILeadRepository, LeadFilters } from "../domain/repositories/ILeadRepository";

function mapPrismaLead(raw: any): Lead {
  return {
    ...raw,
    opportunities: Array.isArray(raw.opportunities) ? raw.opportunities : JSON.parse(raw.opportunities ?? "[]"),
  };
}

export class PrismaLeadRepository implements ILeadRepository {
  async create(input: CreateLeadInput): Promise<Lead> {
    const lead = await prisma.lead.create({
      data: {
        ...input,
        phone: input.phone ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        rating: input.rating ?? null,
        reviewCount: input.reviewCount ?? 0,
        hasBookingSystem: input.hasBookingSystem ?? false,
        hasOnlinePayment: input.hasOnlinePayment ?? false,
        opportunities: JSON.stringify(input.opportunities ?? []),
      },
    });
    return mapPrismaLead(lead);
  }

  async createMany(inputs: CreateLeadInput[]): Promise<Lead[]> {
    const leads: Lead[] = [];
    for (const input of inputs) {
      const lead = await this.create(input);
      leads.push(lead);
    }
    return leads;
  }

  async findById(id: string): Promise<Lead | null> {
    const lead = await prisma.lead.findUnique({ where: { id } });
    return lead ? mapPrismaLead(lead) : null;
  }

  async findAll(filters: LeadFilters): Promise<{ leads: Lead[]; total: number }> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const where: any = { userId: filters.userId };
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads: leads.map(mapPrismaLead), total };
  }

  async update(id: string, data: Partial<Lead>): Promise<Lead> {
    const updateData: any = { ...data };
    if (data.opportunities) {
      updateData.opportunities = JSON.stringify(data.opportunities);
    }
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.user;
    delete updateData.emailJobs;

    const lead = await prisma.lead.update({ where: { id }, data: updateData });
    return mapPrismaLead(lead);
  }

  async delete(id: string): Promise<void> {
    await prisma.lead.delete({ where: { id } });
  }
}
