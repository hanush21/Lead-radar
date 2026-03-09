export interface CampaignTemplate {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}
