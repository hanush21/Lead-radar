export const BUSINESS_CATEGORIES = {
  BARBERSHOP: { key: "BARBERSHOP", label: "Barbería", needsBooking: true },
  HAIR_SALON: { key: "HAIR_SALON", label: "Peluquería", needsBooking: true },
  RESTAURANT: { key: "RESTAURANT", label: "Restaurante", needsBooking: true },
  DENTAL_CLINIC: { key: "DENTAL_CLINIC", label: "Clínica Dental", needsBooking: true },
  GYM: { key: "GYM", label: "Gimnasio", needsBooking: false },
  REAL_ESTATE: { key: "REAL_ESTATE", label: "Inmobiliaria", needsBooking: false },
  MECHANIC: { key: "MECHANIC", label: "Taller Mecánico", needsBooking: true },
  VET: { key: "VET", label: "Veterinaria", needsBooking: true },
  BEAUTY_SALON: { key: "BEAUTY_SALON", label: "Centro de Estética", needsBooking: true },
  STORE: { key: "STORE", label: "Tienda Local", needsBooking: false },
  OTHER: { key: "OTHER", label: "Otro", needsBooking: false },
} as const;

export type BusinessCategoryKey = keyof typeof BUSINESS_CATEGORIES;

export function getCategoryLabel(key: string): string {
  const cat = BUSINESS_CATEGORIES[key as BusinessCategoryKey];
  return cat?.label ?? key;
}

export function categoryNeedsBooking(key: string): boolean {
  const cat = BUSINESS_CATEGORIES[key as BusinessCategoryKey];
  return cat?.needsBooking ?? false;
}
