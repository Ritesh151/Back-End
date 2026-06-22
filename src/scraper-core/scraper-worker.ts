import { logger } from '../utils/logger';
import { BrowserPool } from '../browser/browser-pool';
import { ScraperSession } from './scraper-session';
import { ScrapeOptions, ScrapeResult } from '../types/scraper.types';
import { Lead } from '../models/Lead';

export class ScraperWorker {
  private browserPool: BrowserPool;

  constructor(browserPool: BrowserPool) {
    this.browserPool = browserPool;
  }

  async execute(session: ScraperSession, options: ScrapeOptions): Promise<ScrapeResult> {
    session.start();

    const { keyword, location } = options;
    const limit = options.limit || 50;

    try {
      const { page } = await this.browserPool.acquire(session.id);

      page.setDefaultTimeout(30000);

      const results: any[] = [];
      let totalExtracted = 0;
      let totalDuplicates = 0;

      await this.navigateToMaps(page);

      await this.searchBusinesses(page, keyword, location || '');

      await this.scrollAndExtract(page, limit, results);

      const storedLeads = await this.storeLeads(results);

      totalExtracted = results.length;
      totalDuplicates = totalExtracted - storedLeads.totalStored;

      await this.browserPool.release(session.id).catch(() => {});

      session.complete({
        totalExtracted,
        totalStored: storedLeads.totalStored,
        totalDuplicates,
      });

      return {
        success: true,
        message: 'Leads fetched successfully',
        totalExtracted,
        totalStored: storedLeads.totalStored,
        totalDuplicates,
        leads: storedLeads.leads,
      };
    } catch (error: any) {
      logger.error({ err: error.message, keyword, location }, 'ScraperWorker: Execute failed');
      session.fail(error.message);
      throw error;
    }
  }

  private async navigateToMaps(page: any): Promise<void> {
    logger.info('ScraperWorker: Navigating to Google Maps...');
    await page.goto('https://www.google.com/maps', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    }).catch(() => {
      logger.warn('ScraperWorker: Maps navigation timeout, continuing...');
    });
    await page.waitForTimeout(2000);
    logger.info('ScraperWorker: Google Maps loaded');
  }

  private async searchBusinesses(page: any, keyword: string, location: string): Promise<void> {
    const searchQuery = location
      ? `${keyword} in ${location}`
      : keyword;
    logger.info({ searchQuery }, 'ScraperWorker: Searching');

    try {
      const searchBox = await page.waitForSelector('input#searchboxinput', { timeout: 10000 });
      if (searchBox) {
        await searchBox.click();
        await searchBox.fill('');
        await searchBox.fill(searchQuery);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        return;
      }
    } catch (error) {
      logger.warn('ScraperWorker: Primary search failed, trying fallback');
    }

    try {
      const searchBoxAlt = await page.waitForSelector('input[data-query="search"]', { timeout: 5000 });
      if (searchBoxAlt) {
        await searchBoxAlt.fill(searchQuery);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      logger.warn('ScraperWorker: Fallback search also failed');
    }
  }

  private async scrollAndExtract(page: any, limit: number, results: any[]): Promise<void> {
    logger.info({ limit }, 'ScraperWorker: Scrolling and extracting');

    let scrollAttempts = 0;
    const maxScrollAttempts = 8;

    while (results.length < limit && scrollAttempts < maxScrollAttempts) {
      const businesses = await this.extractBusinessesFromPage(page, limit, results);

      if (businesses.length > 0) {
        scrollAttempts = 0;
      } else {
        scrollAttempts++;
      }

      if (results.length >= limit) break;

      await this.scrollToBottom(page);
      await page.waitForTimeout(2000);
    }

    logger.info({ total: results.length }, 'ScraperWorker: Extraction complete');
  }

  private async scrollToBottom(page: any): Promise<void> {
    try {
      const resultsPanel = await page.$('[role="feed"]');
      if (resultsPanel) {
        await resultsPanel.evaluate((el: HTMLElement) => {
          el.scrollTo(0, el.scrollHeight);
        });
        return;
      }
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    } catch {
      logger.warn('ScraperWorker: Scroll failed');
    }
  }

  private async extractBusinessesFromPage(
    page: any,
    limit: number,
    existingResults: any[]
  ): Promise<any[]> {
    const newBusinesses: any[] = [];
    const businessesSelector = 'div[role="article"], div.Nv2PK';

    try {
      await page.waitForSelector(businessesSelector, { timeout: 5000 }).catch(() => {});
    } catch {}

    const businessCount = await page.$$(businessesSelector).then((els: any[]) => els.length).catch(() => 0);
    logger.info({ count: businessCount }, 'ScraperWorker: Business cards found');

    for (let i = 0; i < businessCount && existingResults.length < limit; i++) {
      try {
        const business = await this.extractSingleBusiness(page, i, businessesSelector);

        if (business && business.companyName && !this.isDuplicate(business, existingResults)) {
          existingResults.push(business);
          newBusinesses.push(business);
        }
      } catch {
        continue;
      }
    }

    return newBusinesses;
  }

  private async extractSingleBusiness(page: any, index: number, selector: string): Promise<any | null> {
    try {
      const businessCard = await page.$$(selector);
      if (!businessCard || index >= businessCard.length) return null;

      await businessCard[index].click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);

      const businessData = await this.extractBusinessDataFromDetails(page);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);

      return businessData;
    } catch {
      await page.keyboard.press('Escape').catch(() => {});
      return null;
    }
  }

  private async extractBusinessDataFromDetails(page: any): Promise<any> {
    const data: any = {
      id: crypto.randomUUID(),
      companyName: '',
      website: '',
      phone: '',
      email: '',
      address: '',
      category: '',
      rating: 0,
      reviewsCount: 0,
      source: 'google-maps',
      leadScore: 50,
      createdAt: new Date().toISOString(),
    };

    try {
      const companyName = await this.getTextContent(page, 'h1.DUwDvf');
      if (companyName) data.companyName = companyName;

      const category = await this.getTextContent(page, 'button.DKv0N');
      if (category) data.category = category;

      const phoneSelectors = [
        'button[aria-label*="Phone"]',
        'button[aria-label*="phone"]',
        'button[aria-label*="Call"]',
        'a[aria-label*="Phone"]',
        'button[data-item-id*="phone"]',
        'a[data-item-id*="phone"]',
      ];
      for (const sel of phoneSelectors) {
        const t = await this.getTextContent(page, sel);
        if (t) {
          data.phone = t.replace(/[^\d+]/g, '');
          break;
        }
      }

      const address = await this.getTextContent(page, 'button[aria-label*="Address"]');
      if (address) data.address = address;

      const websiteSelectors = [
        'a[data-item-id*="website"]',
        'a[data-item-id*="authority"]',
        'a[aria-label*="website"]',
        'a[aria-label*="Website"]',
        'a[aria-label*="Web"]',
        'a[data-item-id*="info"]',
      ];
      for (const sel of websiteSelectors) {
        const w = await this.getAttribute(page, sel, 'href');
        if (
          w &&
          !w.includes('google.com/maps') &&
          !w.includes('support.google') &&
          !w.includes('maps.google') &&
          !w.includes('javascript:')
        ) {
          data.website = w.startsWith('http') ? w : `https://${w}`;
          break;
        }
      }

      if (!data.website) {
        try {
          data.website = await page.evaluate(() => {
            const panel = document.querySelector('[role="dialog"], div[role="main"]');
            if (!panel) return '';
            const allLinks = Array.from(panel.querySelectorAll('a[href]'));
            for (const link of allLinks) {
              const href = link.getAttribute('href') || '';
              const lower = href.toLowerCase();
              if (
                lower.startsWith('http') &&
                !lower.includes('google.com/maps') &&
                !lower.includes('support.google') &&
                !lower.includes('maps.google') &&
                !lower.startsWith('javascript:') &&
                !lower.startsWith('#')
              ) {
                let result = href;
                try {
                  const parsed = new URL(href);
                  if (parsed.hostname.includes('google.') && parsed.searchParams.get('q')) {
                    result = parsed.searchParams.get('q') || href;
                  }
                } catch {}
                return result.startsWith('http') ? result : `https://${result}`;
              }
            }
            return '';
          });
        } catch {}
      }

      const ratingText = await this.getAttribute(page, 'span[aria-label*="stars"]', 'aria-label');
      if (ratingText) {
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        if (ratingMatch) data.rating = parseFloat(ratingMatch[1]);
      }

      const reviewsText = await this.getAttribute(page, 'span[aria-label*="reviews"]', 'aria-label');
      if (reviewsText) {
        const reviewsMatch = reviewsText.match(/(\d+)/);
        if (reviewsMatch) data.reviewsCount = parseInt(reviewsMatch[1], 10);
      }

      data.leadScore = this.calculateLeadScore(data);

      return data;
    } catch {
      logger.warn('ScraperWorker: Error extracting business data');
      return data;
    }
  }

  private async getTextContent(page: any, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) return await element.innerText();
    } catch {}
    return null;
  }

  private async getAttribute(page: any, selector: string, attribute: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) return await element.getAttribute(attribute);
    } catch {}
    return null;
  }

  private isDuplicate(business: any, existing: any[]): boolean {
    return existing.some(
      (b) => b.companyName === business.companyName && b.phone === business.phone
    );
  }

  private calculateLeadScore(data: any): number {
    let score = 50;
    if (data.website) score += 10;
    if (data.email) score += 10;
    if (data.address) score += 5;
    if (data.category) score += 5;
    if (data.rating && data.rating >= 4.5) score += 20;
    else if (data.rating && data.rating >= 4.0) score += 15;
    else if (data.rating && data.rating >= 3.5) score += 10;
    return Math.min(score, 100);
  }

  private async storeLeads(
    leads: any[]
  ): Promise<{ totalStored: number; leads: any[] }> {
    const storedLeads: any[] = [];
    for (const lead of leads) {
      try {
        if (!lead.companyName) continue;

        const existingLead = await Lead.findOne({
          $or: [
            { companyName: lead.companyName, phone: lead.phone },
            ...(lead.website ? [{ website: lead.website }] : []),
          ],
        });
        if (existingLead) continue;

        const newLead = new Lead({
          companyName: lead.companyName,
          website: lead.website || undefined,
          phone: lead.phone || undefined,
          email: lead.email || undefined,
          address: lead.address || undefined,
          category: lead.category || undefined,
          source: lead.source,
          rating: lead.rating || undefined,
          reviewsCount: lead.reviewsCount || undefined,
          leadScore: lead.leadScore,
          searchedKeyword: lead.searchedKeyword || '',
          searchedLocation: lead.searchedLocation || '',
        });
        await newLead.save();
        storedLeads.push(lead);
        logger.info({ company: lead.companyName }, 'ScraperWorker: Lead saved');
      } catch (error: any) {
        logger.warn({ err: error.message, company: lead.companyName }, 'ScraperWorker: Store failed');
      }
    }
    return { totalStored: storedLeads.length, leads: storedLeads };
  }
}
