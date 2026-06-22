// Scraper types and interfaces

export interface BusinessData {
  id: string;
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  source: string;
  leadScore: number;
  createdAt: string;
  area?: string;
  city?: string;
  state?: string;
  businessType?: string;
  fullSearchQuery?: string;
  locationRelevanceScore?: number;
  isLocationValidated?: boolean;
}

export interface ScrapeOptions {
  keyword: string;
  location?: string;
  state?: string;
  city?: string;
  area?: string;
  businessType?: string;
  sources?: string[];
  limit?: number;
  sessionId?: string;
}

export interface ScrapeResult {
  success: boolean;
  message: string;
  totalExtracted: number;
  totalStored: number;
  totalDuplicates: number;
  leads: BusinessData[];
  totalFound?: number;
  scrapedCount?: number;
}

export interface BusinessCardData {
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
}

export type BrowserContext = {
  browser: any;
  page: any;
  context: any;
};
