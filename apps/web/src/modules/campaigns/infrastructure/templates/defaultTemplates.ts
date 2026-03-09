export interface DefaultCampaignTemplate {
  slug: string;
  name: string;
  category: string;
  isDefault: boolean;
  isActive: boolean;
  subjectTemplate: string;
  headlineTemplate: string;
  introTemplate: string;
  bodyTemplate: string;
  ctaLabelTemplate: string;
  ctaUrlTemplate: string;
  signatureTemplate: string;
}

function buildTemplate(category: string, name: string, valueProp: string): DefaultCampaignTemplate {
  return {
    slug: `${category.toLowerCase()}-default`,
    name,
    category,
    isDefault: true,
    isActive: true,
    subjectTemplate: `{{businessName}}: plan concreto de captacion para {{categoryLabel}}`,
    headlineTemplate: "Hola {{businessName}}, te compartimos un diagnostico y propuesta",
    introTemplate:
      "Revisamos tu presencia digital en {{city}} y detectamos mejoras accionables para captar mas clientes cualificados.",
    bodyTemplate:
      `${valueProp} Diagnostico resumido: {{diagnosticSummary}}. Si te interesa, te enviamos una propuesta con alcance, tiempos y estimacion de inversion.`,
    ctaLabelTemplate: "Solicitar propuesta detallada",
    ctaUrlTemplate: "https://leadradar.local/propuesta?lead={{leadId}}",
    signatureTemplate: "Responde a {{replyEmail}} y te respondemos en menos de 24h. Equipo de LeadRadar",
  };
}

export const DEFAULT_CAMPAIGN_TEMPLATES: DefaultCampaignTemplate[] = [
  buildTemplate(
    "BARBERSHOP",
    "Barberia profesional",
    "Te ayudamos a convertir busquedas locales en citas reales con mejor presencia y seguimiento."
  ),
  buildTemplate(
    "HAIR_SALON",
    "Peluqueria crecimiento local",
    "Optimizamos captacion para aumentar reservas recurrentes y reducir huecos de agenda."
  ),
  buildTemplate(
    "RESTAURANT",
    "Restauracion reservas directas",
    "Impulsamos reservas directas y pedidos con mejor experiencia movil y respuesta comercial."
  ),
  buildTemplate(
    "DENTAL_CLINIC",
    "Clinica dental conversion",
    "Mejoramos conversion de primeras consultas con mensajes de confianza y rutas claras de contacto."
  ),
  buildTemplate(
    "GYM",
    "Gimnasio altas de socios",
    "Potenciamos altas de nuevos socios y recuperacion de interesados con seguimiento automatizado."
  ),
  buildTemplate(
    "REAL_ESTATE",
    "Inmobiliaria leads cualificados",
    "Aumentamos contactos cualificados de compradores e inquilinos con mejor embudo digital."
  ),
  buildTemplate(
    "MECHANIC",
    "Taller mecanico agenda llena",
    "Captamos solicitudes de revision y mantenimiento con procesos simples de contacto y cierre."
  ),
  buildTemplate(
    "VET",
    "Veterinaria fidelizacion",
    "Mejoramos captacion y fidelizacion de clientes de veterinaria con comunicacion oportuna."
  ),
  buildTemplate(
    "BEAUTY_SALON",
    "Centro de estetica resultados",
    "Aumentamos reservas de tratamientos con propuestas mas claras y foco en conversion."
  ),
  buildTemplate(
    "STORE",
    "Tienda local ventas",
    "Impulsamos trafico y ventas locales con activaciones digitales y seguimiento comercial."
  ),
  {
    slug: "other-default",
    name: "Plantilla general profesional",
    category: "OTHER",
    isDefault: true,
    isActive: true,
    subjectTemplate: "{{businessName}}: propuesta concreta para mejorar tu captacion",
    headlineTemplate: "Hola {{businessName}}, te compartimos analisis y siguientes pasos",
    introTemplate:
      "Analizamos {{businessName}} en {{city}} para identificar mejoras comerciales de impacto rapido.",
    bodyTemplate:
      "Nuestro enfoque combina visibilidad local, respuesta comercial y seguimiento para aumentar conversion en {{categoryLabel}}. Diagnostico resumido: {{diagnosticSummary}}. Si te encaja, preparamos una propuesta detallada.",
    ctaLabelTemplate: "Pedir propuesta detallada",
    ctaUrlTemplate: "https://leadradar.local/propuesta?lead={{leadId}}",
    signatureTemplate: "Responde a {{replyEmail}} y continuamos por correo. Equipo de LeadRadar",
  },
];
