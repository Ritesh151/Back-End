import { scraperEngine } from '../core/scraper-engine/scraper-engine';
import { LeadData } from '../source-core/base-source';
import type { SourceQuery } from './search-query-builder';
import { logger } from '../utils/logger';

export interface ScrapeOptions {
  keyword: string;
  location?: string;
  sources?: string[];
  limit: number;
  state?: string;
  city?: string;
  area?: string;
  businessType?: string;
  sessionId?: string;
  semanticExpansion?: boolean;
}

export interface ScrapeResult {
  success: boolean;
  message: string;
  results: {
    [sourceName: string]: {
      totalExtracted: number;
      totalStored: number;
      totalDuplicates: number;
    };
  };
  totalExtracted: number;
  totalStored: number;
  totalDuplicates: number;
  leads: LeadData[];
  sourceQueries?: SourceQuery[];
}

function toLeadData(lead: any): LeadData {
  return {
    id: lead.placeId || `${lead.companyName}-${Date.now()}`,
    companyName: lead.companyName,
    website: lead.website,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    category: lead.category,
    rating: lead.rating,
    reviewsCount: lead.reviewsCount,
    source: lead.source,
    sourceUrl: lead.sourceUrl,
    href: lead.href,
    placeId: lead.placeId,
    createdAt: new Date().toISOString(),
    area: lead.area,
    city: lead.city,
    state: lead.state,
    businessType: lead.businessType,
    fullSearchQuery: lead.fullSearchQuery,
    relevanceScore: lead.relevanceScore,
    validatedCategory: lead.validatedCategory,
    sources: lead.sources || [lead.source],
  };
}

export class ScraperService {
  async scrapeBusinesses(options: ScrapeOptions): Promise<ScrapeResult> {
    const { keyword, location, sources = [], limit = 1000, state, city, area, businessType, sessionId } = options;

    const searchQuery = `${businessType || keyword} in ${[area, city, state].filter(Boolean).join(' ')}`.trim();

    logger.info({
      action: 'search_started',
      keyword, area, city, state, sources, limit, sessionId,
      searchQuery,
    }, 'ScraperService: Starting multi-source scrape');

    try {
      const result = await scraperEngine.scrapeMultiSource({
        keyword,
        location,
        sources: sources.length > 0 ? sources : ['google-maps', 'justdial', 'indiamart'],
        limit,
        state,
        city,
        area,
        businessType: businessType || keyword,
        sessionId,
      });

      const leads: LeadData[] = result.leads.map(toLeadData);

      const results: Record<string, { totalExtracted: number; totalStored: number; totalDuplicates: number }> = {};
      for (const sr of result.sourceResults) {
        results[sr.source] = {
          totalExtracted: sr.totalExtracted,
          totalStored: sr.totalStored,
          totalDuplicates: sr.totalDuplicates,
        };
      }

      logger.info({
        action: 'search_completed',
        totalExtracted: result.totalExtracted,
        totalStored: result.totalStored,
        totalDuplicates: result.totalDuplicates,
        sources: sources.length,
        keyword, area, city, state,
      }, 'ScraperService: Multi-source scrape completed');

      return {
        success: result.success || result.totalStored > 0,
        message: result.message,
        results,
        totalExtracted: result.totalExtracted,
        totalStored: result.totalStored,
        totalDuplicates: result.totalDuplicates,
        leads,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown scraping error';
      logger.error({
        action: 'search_failed',
        err: message, keyword, area, city, state,
      }, 'ScraperService: Multi-source scrape failed');
      return {
        success: false,
        message: `Multi-source scraping failed: ${message}`,
        results: {},
        totalExtracted: 0,
        totalStored: 0,
        totalDuplicates: 0,
        leads: [],
      };
    }
  }
}

export const scraperService = new ScraperService();
