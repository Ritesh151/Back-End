import { QualificationLevel, WebsiteStatus } from './qualification.types';

// Base types
export * from './scraper.types';
export { WebsiteAnalysis, LeadAnalysis, AnalysisResult } from './analysis.types';
export * from './auth';
export * from './qualification.types';

// Export types
export interface ExportFilters {
  qualificationLevel?: QualificationLevel;
  websiteStatus?: WebsiteStatus;
  category?: string;
  minLeadScore?: number;
  maxLeadScore?: number;
  search?: string;
}

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface RequestWithPagination extends Request {
  query: {
    page?: string;
    limit?: string;
    [key: string]: string | string[] | undefined;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeadDocument {
  _id: string;
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  industry?: string;
  source: string;
  websiteStatus: string;
  rating?: number;
  reviewsCount?: number;
  leadScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchRequest {
  keyword: string;
  location: string;
  limit?: number;
}

export interface SearchResponse {
  results: LeadDocument[];
  totalCount: number;
}
