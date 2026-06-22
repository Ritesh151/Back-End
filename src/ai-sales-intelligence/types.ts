export interface LeadScoreInput {
  seoScore: number;
  uiuxScore: number;
  responsiveScore: number;
  trustScore: number;
  socialPresenceScore: number;
  websiteQualityScore: number;
  websiteFreshnessStatus: string;
  hasContactForm: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  rating: number;
  reviewsCount: number;
}

export interface SalesIntelligenceReport {
  aiLeadScore: number;
  conversionProbability: 'low' | 'medium' | 'high';
  websiteRedesignPotential: 'low' | 'medium' | 'high';
  seoOpportunity: 'low' | 'medium' | 'high';
  digitalMarketingOpportunity: 'low' | 'medium' | 'high';
  revenuePotential: 'low' | 'medium' | 'high' | 'enterprise';
  salesPriority: 'low' | 'medium' | 'high' | 'urgent';
  aiInsight: string;
  competitionLevel: 'low' | 'medium' | 'high';
  marketOpportunity: 'low' | 'medium' | 'high';
  analyzedAt: Date;
  salesIntelligenceCompleted: boolean;
}

export interface SalesAnalysisOptions {
  timeout?: number;
}

export interface CompetitorContext {
  totalLeadsInSameArea: number;
  totalLeadsInSameCategory: number;
  averageScoreInCategory: number;
  averageTrustScoreInCategory: number;
}
