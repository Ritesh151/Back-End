import { logger } from '../../utils/logger';
import { BaseSource, SourceOptions, ScrapingResult, LeadData } from '../../source-core/base-source';
import { SourceConfig } from '../../source-core/source-config';
import { scrapingProgress } from '../../services/scraping-progress';
import { businessRelevanceValidator } from '../../services/business-relevance-validator';
import { IndiaMartScraper as NewIndiaMartScraper } from '../../modules/scrapers/indiamart/indiamart.scraper';
import type { ScraperOptions } from '../../core/scraper-engine/types';

const newScraper = new NewIndiaMartScraper();

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
    source: lead.source || 'indiamart',
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

export class IndiaMartSource extends BaseSource {
  constructor(config?: Partial<SourceConfig>) {
    super('indiamart', config);
  }

  async scrape(options: SourceOptions): Promise<ScrapingResult> {
    const { keyword, location = '', state, city, area, businessType, sessionId } = options;

    if (!keyword || keyword.trim().length === 0) {
      logger.error({}, 'IndiaMartSource: Empty keyword provided');
      return {
        success: false,
        message: 'Invalid keyword: keyword is required',
        totalExtracted: 0,
        totalStored: 0,
        totalDuplicates: 0,
        leads: [],
      };
    }

    logger.info({
      keyword, state, city, area, businessType,
    }, 'IndiaMartSource: Delegating to new scraper module');

    const engineOptions: ScraperOptions = {
      keyword: businessType || keyword,
      location: location || '',
      sources: ['indiamart'],
      limit: 1000,
      state,
      city,
      area,
      businessType: businessType || keyword,
      sessionId: sessionId || scrapingProgress.generateSessionId(),
    };

    try {
      const result = await newScraper.scrape(engineOptions);

      const leads: LeadData[] = result.leads.map(toLeadData);

      const validatedLeads: LeadData[] = [];
      for (const lead of leads) {
        const relevance = businessRelevanceValidator.validate(
          lead.companyName,
          lead.category,
          businessType || keyword
        );

        if (!relevance.relevant || relevance.score < 25) {
          logger.info({
            business: lead.companyName, reason: 'relevance_low', score: relevance.score,
          }, 'IndiaMartSource: Rejected by relevance');
          continue;
        }

        lead.relevanceScore = relevance.score;
        lead.validatedCategory = relevance.validatedCategory;

        if (area) {
          const locCheck = businessRelevanceValidator.validateLocation(
            lead.address,
            area,
            city,
            state
          );
          if (!locCheck.relevant) {
            logger.info({
              business: lead.companyName, reason: 'area_mismatch',
            }, 'IndiaMartSource: Rejected by area');
            continue;
          }
        }

        lead.leadScore = this.calculateLeadScore(lead);
        validatedLeads.push(lead);
      }

      const stored = await this.storeLeads(validatedLeads, {
        keyword,
        location: area || location,
        area,
        city,
        state,
        businessType: businessType || keyword,
        fullSearchQuery: keyword,
      });

      logger.info({
        totalExtracted: result.totalExtracted,
        totalStored: stored.totalStored,
        totalDuplicates: stored.totalDuplicates,
        validatedSaved: validatedLeads.length,
      }, 'IndiaMartSource: Delegated scrape completed');

      return {
        success: stored.totalStored > 0,
        message: stored.totalStored > 0
          ? `IndiaMart completed: ${stored.totalStored} saved`
          : 'No relevant businesses found on IndiaMart',
        totalExtracted: result.totalExtracted,
        totalStored: stored.totalStored,
        totalDuplicates: stored.totalDuplicates,
        leads: stored.leads,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg, keyword }, 'IndiaMartSource: Delegated scrape failed');
      return {
        success: false,
        message: `IndiaMart failed: ${errMsg}`,
        totalExtracted: 0,
        totalStored: 0,
        totalDuplicates: 0,
        leads: [],
      };
    }
  }
}
