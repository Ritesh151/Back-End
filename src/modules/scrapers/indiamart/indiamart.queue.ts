import pLimit from 'p-limit';
import { Page } from 'playwright';
import { logger } from '../../../utils/logger';
import type { IndiaMartRawListing, ScraperStats } from './indiamart.types';
import { crawlProfile } from './indiamart.profile';
import { validateLead } from './indiamart.validator';
import { enrichToScraperLead, computeLeadScore } from './indiamart.normalizer';
import type { ScraperLead } from '../../../core/scraper-engine/types';

const CONCURRENCY = 3;

export class IndiaMartProfileQueue {
  private limit: pLimit.Limit;
  private page: Page;
  private results: ScraperLead[] = [];
  private failed: string[] = [];
  private stats: ScraperStats;
  private context: {
    keyword: string;
    location: string;
    area?: string;
    city?: string;
    state?: string;
    businessType: string;
  };

  constructor(
    page: Page,
    context: {
      keyword: string;
      location: string;
      area?: string;
      city?: string;
      state?: string;
      businessType: string;
    }
  ) {
    this.limit = pLimit(CONCURRENCY);
    this.page = page;
    this.results = [];
    this.failed = [];
    this.context = context;
    this.stats = {
      totalListingsFound: 0,
      totalProfilesOpened: 0,
      totalProfilesFailed: 0,
      totalLeadsSaved: 0,
      totalDuplicatesSkipped: 0,
      totalInvalidRejected: 0,
      errors: [],
    };
  }

  async processAll(listings: IndiaMartRawListing[]): Promise<{
    leads: ScraperLead[];
    stats: ScraperStats;
  }> {
    this.stats.totalListingsFound = listings.length;

    if (listings.length === 0) {
      return { leads: [], stats: this.stats };
    }

    logger.info({
      total: listings.length,
      concurrency: CONCURRENCY,
    }, 'IndiaMartQueue: Processing profiles');

    const tasks = listings.map(listing =>
      this.limit(() => this.processSingle(listing))
    );

    await Promise.allSettled(tasks);

    logger.info({
      total: listings.length,
      opened: this.stats.totalProfilesOpened,
      saved: this.stats.totalLeadsSaved,
      failed: this.stats.totalProfilesFailed,
      duplicates: this.stats.totalDuplicatesSkipped,
      invalid: this.stats.totalInvalidRejected,
    }, 'IndiaMartQueue: All profiles processed');

    return { leads: this.results, stats: this.stats };
  }

  private async processSingle(listing: IndiaMartRawListing): Promise<void> {
    const enriched = await crawlProfile(this.page, listing.profileUrl, listing.companyName);
    if (!enriched) {
      this.stats.totalProfilesFailed++;
      this.failed.push(listing.profileUrl);
      return;
    }

    this.stats.totalProfilesOpened++;

    const validation = await validateLead(enriched);
    if (!validation.valid) {
      this.stats.totalInvalidRejected++;
      logger.info({
        company: enriched.companyName,
        reason: validation.reason,
      }, 'IndiaMartQueue: Lead rejected');
      return;
    }

    const scraperLead = enrichToScraperLead(enriched, this.context);
    scraperLead.relevanceScore = computeLeadScore(scraperLead);

    this.results.push(scraperLead);
    this.stats.totalLeadsSaved++;

    logger.info({
      company: scraperLead.companyName,
      phone: scraperLead.phone,
      website: scraperLead.website,
    }, 'IndiaMartQueue: Lead ready');
  }

  getResults(): ScraperLead[] {
    return this.results;
  }

  getStats(): ScraperStats {
    return this.stats;
  }

  getFailed(): string[] {
    return this.failed;
  }
}
