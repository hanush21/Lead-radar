import type { Lead, CreateLeadInput } from "../entities/Lead";

export interface LeadFilters {
  userId: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface LeadUpsertSummary {
  created: number;
  updated: number;
  deduped: number;
}

export interface ILeadRepository {
  create(input: CreateLeadInput): Promise<Lead>;
  createMany(inputs: CreateLeadInput[]): Promise<Lead[]>;
  upsertMany(inputs: CreateLeadInput[]): Promise<{ leads: Lead[]; summary: LeadUpsertSummary }>;
  findById(id: string): Promise<Lead | null>;
  findAll(filters: LeadFilters): Promise<{ leads: Lead[]; total: number }>;
  update(id: string, data: Partial<Lead>): Promise<Lead>;
  delete(id: string): Promise<void>;
}
