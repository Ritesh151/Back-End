// Analysis types and interfaces

export type WebsiteStatus = 
  | 'no-website'
  | 'broken-website'
  | 'outdated-website'
  | 'average-website'
  | 'modern-website';

export type QualificationLevel = 
  | 'high-potential'
  | 'medium-potential'
  | 'low-potential';

export interface WebsiteAnalysis {
  url: string;
  sslEnabled: boolean;
  responseTime: number;
  hasContactPage: boolean;
  hasSocialLinks: {
    facebook: boolean;
    instagram: boolean;
    linkedin: boolean;
    twitter: boolean;
  };
  metaTitle: string;
  metaDescription: string;
  mobileFriendly: boolean;
  modernStructure: boolean;
  seoScore: number;
  qualityScore: number;
  issues: string[];
}

export interface LeadAnalysis {
  leadId: string;
  websiteStatus: WebsiteStatus;
  leadScore: number;
  qualificationLevel: QualificationLevel;
  analyzedAt: string;
  analysisData: WebsiteAnalysis;
}

export interface AnalyzeRequest {
  leadId: string;
}

export interface BulkAnalyzeRequest {
  limit?: number;
  websiteStatus?: WebsiteStatus;
}

export interface AnalysisResult {
  success: boolean;
  message: string;
  totalAnalyzed: number;
  results: LeadAnalysis[];
}

export interface WebsiteWeakness {
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface BusinessOpportunity {
  category: string;
  description: string;
  potential: 'low' | 'medium' | 'high';
}

export interface LeadAnalysisResult {
  leadId: string;
  leadScore: number;
  qualificationLevel: string;
  websiteWeaknesses: WebsiteWeakness[];
  businessOpportunities: BusinessOpportunity[];
  summary: string;
  analyzedAt: string;
}

export interface BulkAnalysisResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: LeadAnalysisResult[];
}
