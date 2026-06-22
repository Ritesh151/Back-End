import { logger } from '../../../utils/logger';
import { browserManager } from '../../../core/scraper-engine/browser-manager';
import { leadStorage } from '../../../core/scraper-engine/lead-storage';
import { searchStatus } from '../../../services/search-status.service';
import type { ScraperLead, ScraperResult, ScraperOptions } from '../../../core/scraper-engine/types';
import { extractListings } from './indiamart.extractor';
import { IndiaMartProfileQueue } from './indiamart.queue';
import type { IndiaMartRawListing, ScraperStats } from './indiamart.types';

const MAX_LISTINGS_PER_SESSION = 150;

export class IndiaMartScraper {
  async scrape(options: ScraperOptions & { semanticKeyword?: string }): Promise<ScraperResult> {
    const { keyword, location = '', state, city, area, businessType, sessionId, semanticKeyword } = options;

    if (!keyword || keyword.trim().length === 0) {
      return {
        success: false, message: 'Invalid keyword', totalExtracted: 0,
        totalStored: 0, totalDuplicates: 0, leads: [], sourceResults: [],
      };
    }

    logger.info({
      keyword, state, city, area, businessType,
    }, 'IndiaMartScraper: Starting');

    const allLeads: ScraperLead[] = [];
    let totalExtracted = 0;
    let totalStored = 0;
    let totalDuplicates = 0;
    let stats: ScraperStats | null = null;

    const { page } = await browserManager.acquire('indiamart');

    try {
      const listings = await extractListings(page, keyword, city, area);

      const dedupedListings = this.deduplicateListings(listings);
      const limitedListings = dedupedListings.slice(0, MAX_LISTINGS_PER_SESSION);
      totalExtracted = limitedListings.length;
      if (sessionId) {
        searchStatus.updateLeadsFound(sessionId, totalExtracted);
      }

      if (limitedListings.length === 0) {
        logger.info({ keyword }, 'IndiaMartScraper: No listings found');
        return {
          success: false, message: 'No listings found on IndiaMart',
          totalExtracted: 0, totalStored: 0, totalDuplicates: 0,
          leads: [], sourceResults: [],
        };
      }

      const queue = new IndiaMartProfileQueue(page, {
        keyword,
        location,
        area,
        city,
        state,
        businessType: businessType || keyword,
      });

      const result = await queue.processAll(limitedListings);
      stats = result.stats;

      for (const lead of result.leads) {
        const stored = await leadStorage.storeLeads([lead], {
          keyword,
          location: area || location,
          area,
          city,
          state,
          businessType: businessType || keyword,
          semanticKeyword,
          sessionId,
        });

        if (stored.totalStored > 0) {
          allLeads.push(lead);
          totalStored++;
        } else if (stored.totalDuplicates > 0) {
          totalDuplicates++;
        }
      }

      logger.info({
        totalListings: stats.totalListingsFound,
        profilesOpened: stats.totalProfilesOpened,
        profilesFailed: stats.totalProfilesFailed,
        invalidRejected: stats.totalInvalidRejected,
        totalStored,
        totalDuplicates,
      }, 'IndiaMartScraper: Completed');

      return {
        success: allLeads.length > 0,
        message: allLeads.length > 0
          ? `IndiaMart completed: ${allLeads.length} leads saved`
          : 'No valid leads found on IndiaMart',
        totalExtracted,
        totalStored,
        totalDuplicates,
        leads: allLeads,
        sourceResults: [{
          source: 'indiamart',
          totalStored,
          totalExtracted,
          totalDuplicates,
          success: allLeads.length > 0,
        }],
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown IndiaMart error';
      logger.error({
        err: errMsg, keyword, sessionId,
        partialStored: allLeads.length,
      }, 'IndiaMartScraper: Failed');

      return {
        success: allLeads.length > 0,
        message: allLeads.length > 0
          ? `IndiaMart completed with warnings: ${allLeads.length} leads`
          : `IndiaMart failed: ${errMsg}`,
        totalExtracted,
        totalStored,
        totalDuplicates,
        leads: allLeads,
        sourceResults: [{
          source: 'indiamart',
          totalStored,
          totalExtracted,
          totalDuplicates,
          success: allLeads.length > 0,
          error: allLeads.length > 0 ? undefined : errMsg,
        }],
      };
    } finally {
      await browserManager.release(page, 'indiamart');
    }
  }

  private deduplicateListings(listings: IndiaMartRawListing[]): IndiaMartRawListing[] {
    const seen = new Map<string, IndiaMartRawListing>();
    for (const l of listings) {
      const key = l.companyName.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, l);
      }
    }
    return Array.from(seen.values());
  }
}
