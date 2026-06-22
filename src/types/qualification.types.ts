export enum QualificationLevel {
  HOT = 'hot',
  WARM = 'warm',
  COLD = 'cold',
  UNQUALIFIED = 'unqualified'
}

export enum WebsiteStatus {
  UNKNOWN = 'unknown',
  NO_WEBSITE = 'no-website',
  BROKEN = 'broken-website',
  OUTDATED = 'outdated-website',
  AVERAGE = 'average-website',
  MODERN = 'modern-website'
}

export interface AnalyzeRequest {
  leadId: string;
  website?: string;
}

export interface BulkAnalyzeRequest {
  leadIds: string[];
}
