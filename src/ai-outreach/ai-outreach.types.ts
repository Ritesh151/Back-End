export interface LeadInput {
  companyName: string;
  website?: string;
  category?: string;
  industry?: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  aiLeadScore?: number;
  trustScore?: number;
  websiteQualityScore?: number;
  socialPresenceScore?: number;
  responsiveScore?: number;
  uiuxScore?: number;
  mobileExperienceScore?: number;
  seoOpportunity?: string;
  websiteRedesignPotential?: string;
  digitalMarketingOpportunity?: string;
  conversionProbability?: string;
  revenuePotential?: string;
  salesPriority?: string;
  aiSummary?: string;
  aiInsight?: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendedAction: string;
    expectedOutcome: string;
  };
  businessOpportunity?: {
    level: string;
    score: number;
    reasons: string[];
    recommendation: string;
  };
  aiRecommendation?: {
    summary: string;
    services: string[];
    priority: string;
    keyIssues: string[];
  };
  websiteFreshness?: {
    status: string;
    designGeneration: string;
    modernStandards: boolean;
  };
  footerAudit?: {
    copyrightDetected: boolean;
    copyrightYear: number | null;
    privacyPolicy: boolean;
    termsPage: boolean;
  };
  socialAudit?: {
    socialPresenceScore: number;
    facebook: boolean;
    instagram: boolean;
    linkedin: boolean;
  };
  contactAudit?: {
    phoneDetected: boolean;
    emailDetected: boolean;
    contactForm: boolean;
    contactMethods: number;
  };
  responsiveAudit?: {
    mobileFriendly: boolean;
    responsiveLayout: boolean;
    viewportMeta: boolean;
    touchFriendly: boolean;
  };
}

export interface GeneratedEmail {
  type: 'website-redesign' | 'seo' | 'digital-marketing' | 'performance';
  subject: string;
  body: string;
}

export interface GeneratedWhatsAppMessage {
  type: 'short-pitch' | 'medium-pitch' | 'aggressive' | 'friendly';
  content: string;
}

export interface GeneratedProposal {
  type: 'seo' | 'website-redesign' | 'digital-marketing' | 'performance';
  title: string;
  html: string;
  summary: string;
  services: string[];
  estimatedTimeline: string;
  estimatedInvestment: string;
}

export interface FollowUpEntry {
  stage: number;
  type: 'email' | 'whatsapp';
  subject?: string;
  content: string;
  delayDays: number;
}

export interface OutreachScoreResult {
  outreachProbability: 'low' | 'medium' | 'high';
  outreachProbabilityScore: number;
  factors: {
    aiLeadScore: number;
    websiteQuality: number;
    socialPresence: number;
    reviewsActivity: number;
    digitalMaturity: number;
  };
}

export interface OutreachGenerationInput {
  lead: LeadInput;
  emailTypes: string[];
  whatsappTypes: string[];
  proposalTypes: string[];
}

export interface OutreachReport {
  leadId: string;
  companyName: string;
  emails: GeneratedEmail[];
  whatsappMessages: GeneratedWhatsAppMessage[];
  proposals: GeneratedProposal[];
  followupSequence: FollowUpEntry[];
  outreachScore: OutreachScoreResult;
  generatedAt: string;
}
