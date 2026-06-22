export interface ScraperLead {
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  source: string;
  sourceUrl?: string;
  href?: string;
  placeId?: string;
  city?: string;
  state?: string;
  area?: string;
  businessType?: string;
  fullSearchQuery?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  workingHours?: string;
  products?: string;
  gst?: string;
  locationRelevanceScore?: number;
  relevanceScore?: number;
  validatedCategory?: string;
  sources?: string[];
}

export interface ScraperResult {
  success: boolean;
  message: string;
  totalExtracted: number;
  totalStored: number;
  totalDuplicates: number;
  leads: ScraperLead[];
  sourceResults: SourceResult[];
  partialSuccess?: boolean;
  errors?: ScraperError[];
}

export interface SourceResult {
  source: string;
  totalStored: number;
  totalExtracted: number;
  totalDuplicates: number;
  success: boolean;
  error?: string;
  retriesUsed?: number;
}

export interface ScraperError {
  source: string;
  keyword: string;
  error: string;
  retryable: boolean;
}

export interface ScraperOptions {
  keyword: string;
  location?: string;
  sources: string[];
  limit: number;
  state?: string;
  city?: string;
  area?: string;
  businessType?: string;
  sessionId?: string;
  semanticExpansion?: boolean;
  semanticKeyword?: string;
  userId?: string;
}

export interface ScrapeContext {
  sessionId: string;
  keyword: string;
  location: string;
  state?: string;
  city?: string;
  area?: string;
  businessType: string;
  sources: string[];
  fullSearchQuery: string;
  semanticKeyword?: string;
}

export interface BrowserStats {
  poolSize: number;
  activeBrowsers: number;
  idleBrowsers: number;
  totalPagesCreated: number;
  totalPagesClosed: number;
  browserCrashes: number;
  memoryUsageMB: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

export const NON_RETRYABLE_ERRORS = [
  'invalid query',
  'invalid keyword',
  'invalid location',
  'empty keyword',
  'empty location',
  'bad request',
  'invalid source',
  'validation failed',
  'no results found',
  'invalid selector',
];

export const MAX_CONCURRENCY = {
  'google-maps': 2,
  'justdial': 2,
  'indiamart': 1,
};
