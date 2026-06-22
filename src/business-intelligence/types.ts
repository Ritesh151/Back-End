export interface FooterAnalysis {
  copyrightDetected: boolean;
  copyrightYear: number | null;
  privacyPolicy: boolean;
  termsPage: boolean;
  footerComplete: boolean;
  footerLinks: number;
  hasContactInfo: boolean;
}

export interface SocialAudit {
  instagram: boolean;
  facebook: boolean;
  linkedin: boolean;
  twitter: boolean;
  youtube: boolean;
  whatsapp: boolean;
  socialPresenceScore: number;
  detectedLinks: string[];
}

export interface ContactAudit {
  phoneDetected: boolean;
  emailDetected: boolean;
  contactForm: boolean;
  googleMapsEmbed: boolean;
  officeAddress: boolean;
  whatsappButton: boolean;
  contactMethods: number;
}

export interface WebsiteFreshness {
  status: 'fresh' | 'moderate' | 'outdated' | 'very-outdated';
  copyrightYear: number | null;
  yearsBehind: number;
  staleCopyright: boolean;
  designGeneration: string;
  modernStandards: boolean;
}

export interface TrustScore {
  score: number;
  level: 'high' | 'medium' | 'low';
  factors: {
    ssl: boolean;
    contactPresence: boolean;
    socialPresence: boolean;
    seoQuality: boolean;
    responsiveness: boolean;
    copyrightFresh: boolean;
    businessTransparency: boolean;
  };
}

export interface BusinessOpportunity {
  level: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
  recommendation: string;
  estimatedValue: 'low' | 'medium' | 'high';
}

export interface WebsiteQualityScore {
  overall: number;
  breakdown: {
    seo: number;
    responsiveness: number;
    uiux: number;
    trust: number;
    performance: number;
    socialPresence: number;
  };
}

export interface AIRecommendation {
  summary: string;
  services: string[];
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: string;
  keyIssues: string[];
}

export interface BusinessIntelligenceReport {
  footerAnalysis: FooterAnalysis;
  socialAudit: SocialAudit;
  contactAudit: ContactAudit;
  websiteFreshness: WebsiteFreshness;
  trustScore: TrustScore;
  businessOpportunity: BusinessOpportunity;
  websiteQualityScore: WebsiteQualityScore;
  aiRecommendation: AIRecommendation;
  analyzedAt: Date;
  intelligenceCompleted: boolean;
}

export interface IntelligenceAnalysisOptions {
  timeout?: number;
  includeDeepAnalysis?: boolean;
}

export interface OpportunityFactors {
  poorSEO: boolean;
  outdatedUI: boolean;
  missingResponsiveness: boolean;
  weakSocialPresence: boolean;
  noSSL: boolean;
  noContactForm: boolean;
  outdatedCopyright: boolean;
  poorTrustScore: boolean;
  lowQualityScore: boolean;
}
