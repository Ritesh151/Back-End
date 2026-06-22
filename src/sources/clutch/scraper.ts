import { logger } from '../../utils/logger';
import { BaseSource, SourceOptions, ScrapingResult } from '../../source-core/base-source';
import { clutchSelectors } from './selectors';
import { SourceConfig } from '../../source-core/source-config';
import { browserPool } from '../../services/browser-pool.service';

export class ClutchSource extends BaseSource {
  constructor(config?: Partial<SourceConfig>) {
    super('clutch', config);
  }

  async scrape(options: SourceOptions): Promise<ScrapingResult> {
    const { keyword, location = 'United States', limit = 50 } = options;

    logger.info(`ClutchSource: Starting scrape for "${keyword}"`);

    if (!keyword || keyword.trim().length === 0) {
      logger.error({}, 'ClutchSource: Empty keyword provided');
      return {
        success: false,
        message: 'Invalid keyword: keyword is required',
        totalExtracted: 0,
        totalStored: 0,
        totalDuplicates: 0,
        leads: [],
      };
    }

    const results: any[] = [];
    let totalExtracted = 0;
    let totalDuplicates = 0;

    const poolResource = await browserPool.acquire('clutch');
    const page = poolResource.page;

    try {

      // Navigate to Clutch
      await page.goto('https://clutch.co', { waitUntil: 'networkidle' });

      // Search for businesses
      await this.searchBusinesses(page, keyword, location);

      // Extract businesses
      const duplicates = await this.extractBusinesses(page, limit, results);

      // Store leads
      const stored = await this.storeLeads(results);
      totalExtracted = results.length;
      totalDuplicates = duplicates;

      return {
        success: true,
        message: 'Clutch scraping completed',
        totalExtracted,
        totalStored: stored.totalStored,
        totalDuplicates,
        leads: stored.leads,
      };
    } catch (error: any) {
      logger.error('ClutchSource: Scraping failed:', error);
      throw new Error(`Clutch scraping failed: ${error.message}`);
    } finally {
      await browserPool.release(page, 'clutch');
    }
  }

  private async searchBusinesses(page: any, keyword: string, location: string): Promise<void> {
    logger.info('ClutchSource: Searching for businesses...');

    try {
      // Wait for search input
      await page.waitForSelector(clutchSelectors.searchInput, { timeout: 10000 });

      // Fill search
      await page.fill(clutchSelectors.searchInput, keyword);
      await page.keyboard.press('Enter');

      // Wait for results
      await page.waitForSelector(clutchSelectors.businessCard, { timeout: 15000 });
    } catch (error) {
      logger.warn('ClutchSource: Search failed, trying alternative approach');
      await page.goto(`https://clutch.co/${location.replace(/\s+/g, '-').toLowerCase()}/${keyword.replace(/\s+/g, '-').toLowerCase()}`, {
        waitUntil: 'networkidle',
      });
    }

    logger.info('ClutchSource: Search completed');
  }

  private async extractBusinesses(
    page: any,
    limit: number,
    results: any[]
  ): Promise<number> {
    logger.info(`ClutchSource: Extracting businesses (limit: ${limit})`);
    let duplicates = 0;

    while (results.length < limit) {
      const businesses = await page.$$(clutchSelectors.businessCard);

      if (businesses.length === 0) {
        break;
      }

      for (const business of businesses) {
        if (results.length >= limit) break;

        try {
          const data = await this.extractBusinessData(page, business);

          if (data && !this.isDuplicate(data, results)) {
            data.source = 'clutch';
            data.leadScore = this.calculateLeadScore(data);
            results.push(data);
          } else if (data) {
            duplicates++;
          }
        } catch (error) {
          logger.warn(error instanceof Error ? error : new Error(String(error)), 'ClutchSource: Failed to extract business:');
          continue;
        }
      }

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await page.waitForTimeout(2000);
    }

    logger.info(`ClutchSource: Extracted ${results.length} businesses`);
    return duplicates;
  }

  private async extractBusinessData(page: any, businessElement: any): Promise<any | null> {
    try {
      const data: any = {
        id: crypto.randomUUID(),
        companyName: '',
        phone: '',
        website: '',
        email: '',
        address: '',
        category: '',
        rating: 0,
        reviewsCount: 0,
        sourceUrl: '',
        createdAt: new Date().toISOString(),
      };

      // Company name
      const companyName = await this.getText(page, businessElement, '.company_title');
      if (companyName) data.companyName = companyName;

      // Rating
      const ratingText = await this.getText(page, businessElement, '.rating');
      if (ratingText) {
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        if (ratingMatch) data.rating = parseFloat(ratingMatch[1]);
      }

      // Category
      const category = await this.getText(page, businessElement, '.service_cluster');
      if (category) data.category = category;

      return data;
    } catch (error: any) {
      logger.warn('ClutchSource: Failed to extract business data:', error);
      return null;
    }
  }

  private async getText(_page: any, context: any, selector: string): Promise<string | null> {
    try {
      const element = await context.$(selector);
      if (element) return await element.innerText();
    } catch (error) {}
    return null;
  }

  protected isDuplicate(business: any, existing: any[]): boolean {
    return existing.some(
      (b) => b.companyName === business.companyName && b.phone === business.phone
    );
  }
}
