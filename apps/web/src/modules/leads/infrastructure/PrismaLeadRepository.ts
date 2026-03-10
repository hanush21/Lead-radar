import { prisma } from "@/shared/lib/prisma";
import type { Lead, CreateLeadInput } from "../domain/entities/Lead";
import type { ILeadRepository, LeadFilters, LeadUpsertSummary } from "../domain/repositories/ILeadRepository";
import { buildLeadDedupeKey } from "../domain/services/LeadIdentity";

function mapPrismaLead(raw: any): Lead {
  return {
    ...raw,
    opportunities: Array.isArray(raw.opportunities) ? raw.opportunities : JSON.parse(raw.opportunities ?? "[]"),
    tags: Array.isArray(raw.tags) ? raw.tags : JSON.parse(raw.tags ?? "[]"),
  };
}

export class PrismaLeadRepository implements ILeadRepository {
  async create(input: CreateLeadInput): Promise<Lead> {
    const dedupeKey = input.dedupeKey || buildLeadDedupeKey(input);
    const existing = await prisma.lead.findUnique({
      where: {
        userId_dedupeKey: {
          userId: input.userId,
          dedupeKey,
        },
      },
    });

    const lead = await prisma.lead.upsert({
      where: {
        userId_dedupeKey: {
          userId: input.userId,
          dedupeKey,
        },
      },
      create: {
        ...this.mapCreateInput(input, dedupeKey),
        createdAt: new Date(),
      },
      update: this.mapUpdateInput(input, existing ? mapPrismaLead(existing) : null, dedupeKey),
    });

    return mapPrismaLead(lead);
  }

  async createMany(inputs: CreateLeadInput[]): Promise<Lead[]> {
    const { leads } = await this.upsertMany(inputs);
    return leads;
  }

  async upsertMany(inputs: CreateLeadInput[]): Promise<{ leads: Lead[]; summary: LeadUpsertSummary }> {
    const leads: Lead[] = [];
    let created = 0;
    let updated = 0;

    for (const input of inputs) {
      const dedupeKey = input.dedupeKey || buildLeadDedupeKey(input);
      const existing = await prisma.lead.findUnique({
        where: {
          userId_dedupeKey: {
            userId: input.userId,
            dedupeKey,
          },
        },
      });

      const lead = await prisma.lead.upsert({
        where: {
          userId_dedupeKey: {
            userId: input.userId,
            dedupeKey,
          },
        },
        create: {
          ...this.mapCreateInput(input, dedupeKey),
          createdAt: new Date(),
        },
        update: this.mapUpdateInput(input, existing ? mapPrismaLead(existing) : null, dedupeKey),
      });

      leads.push(mapPrismaLead(lead));
      if (existing) updated++;
      else created++;
    }

    return {
      leads,
      summary: {
        created,
        updated,
        deduped: updated,
      },
    };
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
        orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads: leads.map(mapPrismaLead), total };
  }

  async update(id: string, data: Partial<Lead>): Promise<Lead> {
    const updateData: any = { ...data };
    if (data.opportunities) {
      updateData.opportunities = data.opportunities;
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

  private mapCreateInput(input: CreateLeadInput, dedupeKey: string) {
    return {
      name: input.name,
      category: input.category,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      rating: input.rating ?? null,
      reviewCount: input.reviewCount ?? 0,
      hasBookingSystem: input.hasBookingSystem ?? false,
      hasOnlinePayment: input.hasOnlinePayment ?? false,
      status: "NEW" as const,
      opportunities: this.toPrismaJson(input.opportunities ?? []),
      provider: input.provider || "serpapi",
      providerPlaceId: input.providerPlaceId ?? null,
      dedupeKey,
      leadScore: input.leadScore ?? 0,
      enrichmentStatus: input.enrichmentStatus ?? "PENDING",
      segment: input.segment ?? "WARM",
      tags: this.toPrismaJson(input.tags ?? []),
      sourceQuery: input.sourceQuery,
      userId: input.userId,
      lastSeenAt: input.lastSeenAt ?? new Date(),
    };
  }

  private mapUpdateInput(input: CreateLeadInput, existing: Lead | null, dedupeKey: string) {
    return {
      name: input.name,
      category: input.category,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      phone: input.phone ?? existing?.phone ?? null,
      email: input.email ?? existing?.email ?? null,
      website: input.website ?? existing?.website ?? null,
      rating: input.rating ?? existing?.rating ?? null,
      reviewCount: Math.max(input.reviewCount ?? 0, existing?.reviewCount ?? 0),
      hasBookingSystem: input.hasBookingSystem ?? existing?.hasBookingSystem ?? false,
      hasOnlinePayment: input.hasOnlinePayment ?? existing?.hasOnlinePayment ?? false,
      opportunities: this.toPrismaJson(input.opportunities ?? existing?.opportunities ?? []),
      provider: input.provider || existing?.provider || "serpapi",
      providerPlaceId: input.providerPlaceId ?? existing?.providerPlaceId ?? null,
      dedupeKey,
      leadScore: input.leadScore ?? existing?.leadScore ?? 0,
      enrichmentStatus: input.enrichmentStatus ?? existing?.enrichmentStatus ?? "PENDING",
      segment: input.segment ?? existing?.segment ?? "WARM",
      tags: this.toPrismaJson(input.tags ?? existing?.tags ?? []),
      sourceQuery: input.sourceQuery,
      lastSeenAt: input.lastSeenAt ?? new Date(),
    };
  }

  private toPrismaJson(value: unknown): any {
    return value as any;
  }
}
