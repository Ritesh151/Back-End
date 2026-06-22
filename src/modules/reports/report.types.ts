export type WebsiteReportType = 'standalone' | 'social_only' | 'directory_profile' | 'no_website';

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export type ReportProgressStage =
  | 'initializing'
  | 'collecting_audit'
  | 'analyzing_responsiveness'
  | 'generating_seo_analysis'
  | 'analyzing_performance'
  | 'generating_business_intelligence'
  | 'generating_ai_insights'
  | 'rendering_report'
  | 'generating_pdf'
  | 'saving_report'
  | 'complete'
  | 'error';

export interface ReportData {
  generated: boolean;
  generating: boolean;
  generatedAt: string | null;
  reportUrl: string | null;
  reportPath: string | null;
  htmlPath: string | null;
  score: number | null;
  reportVersion: string | null;
  lastAuditAt: string | null;
  progress: ReportProgress | null;
  failureReason: string | null;
}

export interface ReportProgress {
  stage: ReportProgressStage;
  percent: number;
  message: string;
}

export interface ReportGeneratorOptions {
  leadId: string;
  regenerate?: boolean;
}

export interface ReportGenerationResult {
  success: boolean;
  reportUrl: string | null;
  reportPath: string | null;
  htmlPath: string | null;
  score: number | null;
  message: string;
  generatedAt: string;
}

export interface AuditSummary {
  companyName: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
  rating: number | null;
  reviewsCount: number | null;
  leadScore: number;
  websiteType: WebsiteReportType;
  hasRealWebsite: boolean;
  socialPlatforms: string[];
  primaryPlatform: string | null;

  responsiveAudit: {
    score: number | null;
    mobileFriendly: boolean | null;
    responsiveLayout: boolean | null;
    viewportMeta: boolean | null;
    touchFriendly: boolean | null;
    fontSizeIssues: boolean | null;
    horizontalScroll: boolean | null;
    overflowIssues: boolean | null;
    uiuxScore: number | null;
    mobileScore: number | null;
    desktopScreenshot: string | null;
    mobileScreenshot: string | null;
    issues: Array<{ type: string; severity: string; description: string }>;
  };

  seoAudit: {
    metaTitle: string | null;
    metaDescription: string | null;
    sslEnabled: boolean | null;
    responseTime: number | null;
    hasContactPage: boolean | null;
  };

  businessIntelligence: {
    trustScore: number | null;
    trustScoreLevel: string | null;
    websiteQualityScore: number | null;
    socialPresenceScore: number | null;
    opportunityScore: number | null;
    opportunityLevel: string | null;
    opportunityReasons: string[];
    opportunityRecommendation: string | null;
    redesignPotential: string | null;
    seoOpportunity: string | null;
    digitalMarketingOpportunity: string | null;
    conversionProbability: string | null;
    revenuePotential: string | null;
    salesPriority: string | null;
    competitionLevel: string | null;
    marketOpportunity: string | null;
    aiSummary: string | null;
    aiWeaknesses: string[];
    aiOpportunities: string[];
    aiRecommendation: string | null;
    freshness: {
      status: string | null;
      copyrightYear: number | null;
      designGeneration: string | null;
    };
    socialAudit: {
      instagram: boolean;
      facebook: boolean;
      linkedin: boolean;
      youtube: boolean;
      whatsapp: boolean;
      detectedLinks: string[];
    };
    contactAudit: {
      phoneDetected: boolean;
      emailDetected: boolean;
      contactForm: boolean;
      contactMethods: number;
    };
  };

  outreach: {
    probability: string | null;
    probabilityScore: number | null;
    sampleEmail: string | null;
    sampleWhatsApp: string | null;
  };

  socialOnlyAnalysis: {
    isSocialOnly: boolean;
    socialMediaPresence: string[];
    brandingPotential: string;
    credibilityImpact: string;
    conversionLimitations: string[];
    recommendation: string;
    missingWebsiteOpportunity: string;
  } | null;
}
