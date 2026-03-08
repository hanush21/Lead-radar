import { z } from "zod";

export const SearchLeadsDtoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.1).max(100),
  category: z.string().min(1).max(100),
});

export type SearchLeadsDto = z.infer<typeof SearchLeadsDtoSchema>;
