import type { Page } from 'playwright';
import { logger } from '../../../../utils/logger';
import { browserManager } from '../../browser-manager';
import { leadStorage } from '../../lead-storage';
import { leadNormalizer } from '../../lead-normalizer';
import type { ScraperLead, ScraperResult, ScrapeContext, ScraperOptions } from '../../types';
import { searchStatus } from '../../../../services/search-status.service';

const NAV_TIMEOUT = 45000;
const DETAIL_TIMEOUT = 20000;
const MAX_STALLED_SCROLLS = 30;
const CONSECUTIVE_EMPTY_LIMIT = 8;
const MAX_RETRIES_PER_DETAIL = 2;
const SCROLL_WAIT_MS = 1500;

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class GoogleMapsScraper {
  private allLeads: ScraperLead[] = [];
  private allScrapedNames = new Set<string>();
  private allScrapedPlaceIds = new Set<string>();

  private searchUrl = '';

  async scrape(options: ScraperOptions & { semanticKeyword?: string }): Promise<ScraperResult> {
    const { keyword, location = '', state, city, area, businessType, sessionId, semanticKeyword } = options;

    if (!keyword || keyword.trim().length === 0) {
      return {
        success: false, message: 'Invalid keyword', totalExtracted: 0,
        totalStored: 0, totalDuplicates: 0, leads: [], sourceResults: [],
      };
    }

    const searchQuery = `${businessType || keyword} in ${[area, city, state, location].filter(Boolean).join(' ')}`;
    const fullSearchQuery = searchQuery;
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    this.searchUrl = searchUrl;

    const context: ScrapeContext = {
      sessionId: sessionId || `gm_${Date.now()}`,
      keyword, location, state, city, area,
      businessType: businessType || keyword,
      sources: ['google-maps'],
      fullSearchQuery,
      semanticKeyword,
    };

    this.allLeads = [];
    this.allScrapedNames = new Set();
    this.allScrapedPlaceIds = new Set();

    const { page } = await browserManager.acquire('google-maps');

    try {
      logger.info({
        url: searchUrl, searchQuery, sessionId: context.sessionId,
      }, 'GoogleMaps: Navigating');

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await page.waitForTimeout(randomDelay(3000, 5000));

      const feedReady = await this.waitForFeed(page);

      if (!feedReady) {
        logger.info({ sessionId: context.sessionId }, 'GoogleMaps: Feed not ready, trying search input');
        const searchLoaded = await this.trySearchInput(page, searchQuery);
        if (!searchLoaded) {
          logger.warn({ sessionId: context.sessionId }, 'GoogleMaps: Could not load results');
          return {
            success: false, message: 'No results loaded from Google Maps',
            totalExtracted: 0, totalStored: 0, totalDuplicates: 0,
            leads: [], sourceResults: [{ source: 'google-maps', totalStored: 0, totalExtracted: 0, totalDuplicates: 0, success: false, error: 'No results loaded' }],
          };
        }
      }

      logger.info({ sessionId: context.sessionId }, 'GoogleMaps: Feed loaded, starting extraction');

      const result = await this.extractAllLeads(page, context);
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown Google Maps error';
      logger.error({
        err: errMsg, sessionId: context.sessionId, keyword,
      }, 'GoogleMaps: Scrape failed');

      return {
        success: this.allLeads.length > 0,
        message: this.allLeads.length > 0
          ? `Google Maps completed with warnings: ${this.allLeads.length} leads stored`
          : `Google Maps failed: ${errMsg}`,
        totalExtracted: this.allScrapedNames.size,
        totalStored: this.allLeads.length,
        totalDuplicates: 0,
        leads: this.allLeads,
        sourceResults: [{
          source: 'google-maps',
          totalStored: this.allLeads.length,
          totalExtracted: this.allScrapedNames.size,
          totalDuplicates: 0,
          success: this.allLeads.length > 0,
          error: this.allLeads.length > 0 ? undefined : errMsg,
        }],
      };
    } finally {
      await browserManager.release(page, 'google-maps');
    }
  }

  private async waitForFeed(page: Page): Promise<boolean> {
    for (let i = 0; i < 10; i++) {
      const feed = await page.$('[role="feed"]').catch(() => null);
      if (feed) {
        const hasChildren = await page.evaluate(() => {
          const f = document.querySelector('[role="feed"]');
          return f ? f.children.length > 0 : false;
        }).catch(() => false);
        if (hasChildren) return true;
      }

      const cards = await page.$$('div.Nv2PK, a[href*="maps/place/"]').catch(() => []);
      if (cards.length > 0) return true;

      await page.waitForTimeout(randomDelay(1000, 2000));
    }
    return false;
  }

  private async trySearchInput(page: Page, searchQuery: string): Promise<boolean> {
    try {
      const input = await page.$('input#searchboxinput');
      if (!input) return false;

      await input.click();
      await page.waitForTimeout(randomDelay(300, 600));
      await input.fill('');
      await page.waitForTimeout(randomDelay(200, 400));

      for (const char of searchQuery) {
        await page.keyboard.type(char, { delay: randomDelay(30, 80) });
      }

      await page.keyboard.press('Enter');
      await page.waitForTimeout(randomDelay(4000, 6000));

      return await this.waitForFeed(page);
    } catch {
      return false;
    }
  }

  private async extractAllLeads(page: Page, context: ScrapeContext): Promise<ScraperResult> {
    let stalledScrolls = 0;
    let consecutiveEmptyExtracts = 0;

    for (let scrollAttempt = 0; ; scrollAttempt++) {
      if (stalledScrolls >= MAX_STALLED_SCROLLS) {
        logger.info({
          sessionId: context.sessionId,
          totalFound: this.allScrapedNames.size,
          totalSaved: this.allLeads.length,
        }, 'GoogleMaps: Max stalled scrolls reached, stopping');
        break;
      }

      await this.scrollFeed(page);
      await page.waitForTimeout(randomDelay(SCROLL_WAIT_MS, SCROLL_WAIT_MS + 500));

      const newCards = await this.extractCards(page);

      if (newCards.length === 0) {
        stalledScrolls++;
        consecutiveEmptyExtracts++;

        if (consecutiveEmptyExtracts >= CONSECUTIVE_EMPTY_LIMIT) {
          logger.info({
            sessionId: context.sessionId,
            totalFound: this.allScrapedNames.size,
          }, 'GoogleMaps: Consecutive empty extracts limit reached');
          break;
        }

        if (stalledScrolls % 5 === 0) {
          await this.scrollFeedAggressive(page);
          await page.waitForTimeout(randomDelay(2000, 3000));
        }
        continue;
      }

      stalledScrolls = 0;
      consecutiveEmptyExtracts = 0;

      for (const card of newCards) {
        const key = `${card.companyName}|${card.address || ''}`;
        if (!this.allScrapedNames.has(key)) {
          this.allScrapedNames.add(key);
          if (context.sessionId) {
            searchStatus.incrementFound(context.sessionId);
          }
        }
        if (card.placeId) this.allScrapedPlaceIds.add(card.placeId);
      }

      for (const cardLead of newCards) {
        await this.processLead(page, cardLead, context);
      }

      if (this.allLeads.length > 0 && this.allLeads.length % 15 === 0) {
        logger.info({
          sessionId: context.sessionId,
          totalFound: this.allScrapedNames.size,
          totalSaved: this.allLeads.length,
        }, 'GoogleMaps: Progress');
      }
    }

    return {
      success: this.allLeads.length > 0,
      message: this.allLeads.length > 0
        ? `Google Maps completed: ${this.allLeads.length} leads saved`
        : 'No leads found on Google Maps',
      totalExtracted: this.allScrapedNames.size,
      totalStored: this.allLeads.length,
      totalDuplicates: 0,
      leads: this.allLeads,
      sourceResults: [{
        source: 'google-maps',
        totalStored: this.allLeads.length,
        totalExtracted: this.allScrapedNames.size,
        totalDuplicates: 0,
        success: this.allLeads.length > 0,
      }],
    };
  }

  private async extractCards(page: Page): Promise<ScraperLead[]> {
    try {
      return await page.evaluate(() => {
        const leads: ScraperLead[] = [];
        const selectors = ['div.Nv2PK', 'div[role="article"]', 'a[href*="maps/place/"]'];

        let elements: Element[] = [];
        for (const sel of selectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 0) {
            elements = Array.from(found);
            break;
          }
        }

        for (const card of elements) {
          const nameEl = card.querySelector(
            'div.qBF1Pd.fontHeadlineSmall, .fontHeadlineSmall, [aria-label][role="button"]'
          );
          const name = nameEl?.textContent?.trim() || '';
          if (!name || name.length < 2) continue;

          const ratingEl = card.querySelector('span[role="img"][aria-label*="stars"]');
          let rating = 0;
          let reviewsCount = 0;
          if (ratingEl) {
            const label = ratingEl.getAttribute('aria-label') || '';
            const m = label.match(/(\d+\.?\d*)/);
            if (m) rating = parseFloat(m[1]);
            const reviewMatch = label.match(/([\d,]+)\s*reviews?/i);
            if (reviewMatch) reviewsCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10);
          }

          const secondaryEls = card.querySelectorAll('.W4Efsd, .W4Efsd span, [aria-label]');
          const secondaryText = Array.from(secondaryEls)
            .map(el => el.textContent || '')
            .join(' · ');

          const segments = secondaryText.split('·').map(s => s.trim()).filter(Boolean);

          let category = '';
          let address = '';

          for (const seg of segments) {
            const lower = seg.toLowerCase();
            if (lower.match(/^[\d.]+$/) || lower.startsWith('$') ||
                lower.includes('reviews') || lower.includes('star') || seg.length > 80) {
              continue;
            }
            if (!category && !seg.includes(name)) {
              category = seg;
            } else if (seg !== category && !seg.includes(name) && !seg.match(/^[\d.]+$/)) {
              if (!address) address = seg;
              else if (address.length + seg.length < 200) address += ', ' + seg;
            }
          }

          const link = card.querySelector('a.hfpxzc');
          const href = link?.getAttribute('href') || '';
          const placeIdMatch = href.match(/maps\/place\/([^/]+)/);
          const placeId = placeIdMatch ? decodeURIComponent(placeIdMatch[1]) : '';

          leads.push({
            companyName: name,
            rating,
            reviewsCount,
            category,
            address,
            href,
            placeId,
            source: 'google-maps',
            sourceUrl: href,
          });
        }

        return leads;
      });
    } catch {
      return [];
    }
  }

  private async processLead(page: Page, lead: ScraperLead, context: ScrapeContext): Promise<void> {
    try {
      const detailOk = await this.extractDetail(page, lead);
      if (!detailOk) return;

      const stored = await leadStorage.storeLeads([lead], {
        keyword: context.keyword,
        location: context.location,
        area: context.area,
        city: context.city,
        state: context.state,
        businessType: context.businessType,
        fullSearchQuery: context.fullSearchQuery,
        semanticKeyword: context.semanticKeyword,
        sessionId: context.sessionId,
      });

      if (stored.totalStored > 0) {
        this.allLeads.push(lead);
      }
    } catch (error) {
      logger.warn({
        err: error instanceof Error ? error.message : String(error),
        company: lead.companyName,
      }, 'GoogleMaps: Process lead error');
    }
  }

  private async extractDetail(page: Page, lead: ScraperLead): Promise<boolean> {
    for (let retry = 0; retry <= MAX_RETRIES_PER_DETAIL; retry++) {
      const ok = await this.tryExtractDetail(page, lead);
      if (ok) return true;
      if (retry < MAX_RETRIES_PER_DETAIL) {
        await page.waitForTimeout(randomDelay(1000, 2000));
      }
    }
    return false;
  }

  private async tryExtractDetail(page: Page, lead: ScraperLead): Promise<boolean> {
    try {
      if (lead.href) {
        try {
          await page.goto(lead.href, {
            waitUntil: 'domcontentloaded',
            timeout: DETAIL_TIMEOUT,
          });
        } catch {
          logger.warn({ company: lead.companyName }, 'GoogleMaps: Navigation to detail page failed');
        }
      }

      await page.waitForTimeout(randomDelay(1000, 1500));

      await page.evaluate(() => {
        const sel = 'div.m6QErb.DxyBCb.kA9KIf.dS8AEf, div.m6QErb.DxyBCb.kA9KIf, div[role="dialog"]';
        const panel = document.querySelector(sel);
        if (panel) {
          panel.scrollTop = panel.scrollHeight;
          setTimeout(() => { panel.scrollTop = panel.scrollHeight; }, 300);
        }
      });

      await page.waitForTimeout(randomDelay(1000, 1500));

      const website = await this.extractWebsite(page);
      if (website) lead.website = website;

      const phone = await this.extractPhone(page);
      if (phone) lead.phone = phone;

      const address = await this.extractAddress(page);
      if (address) lead.address = address;

      const pincode = this.extractPincode(lead.address || address || '');
      if (pincode) lead.pincode = pincode;

      if (this.searchUrl) {
        await page.goto(this.searchUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(randomDelay(2000, 3000));
      }

      return true;
    } catch {
      if (this.searchUrl) {
        await page.goto(this.searchUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});
      }
      return false;
    }
  }

  private async extractWebsite(page: Page): Promise<string | undefined> {
    const selectors = [
      'a[data-item-id*="authority"]',
      'a[aria-label*="website"]',
      'button[data-tooltip*="Website"]',
      'a[href^="http"]:not([href*="google.com"])',
    ];

    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const href = await el.getAttribute('href').catch(() => null);
        if (href) {
          const normalized = leadNormalizer.normalizeWebsite(href);
          if (normalized) return normalized;
        }
      }
    }

    try {
      const allLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links.map(l => l.getAttribute('href')).filter(Boolean) as string[];
      });

      for (const link of allLinks) {
        const normalized = leadNormalizer.normalizeWebsite(link);
        if (normalized) return normalized;
      }
    } catch {
      // ignore
    }

    return undefined;
  }

  private async extractPhone(page: Page): Promise<string | undefined> {
    const selectors = [
      'button[data-item-id*="phone:tel"]',
      'a[href^="tel:"]',
      'span[aria-label*="phone"]',
    ];

    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const text = await el.textContent().catch(() => null) ||
                     await el.getAttribute('aria-label').catch(() => null) ||
                     await el.getAttribute('href').catch(() => '');

        if (text) {
          const normalized = leadNormalizer.normalizePhone(text);
          if (normalized) return normalized;
        }
      }
    }

    try {
      const allText = await page.evaluate(() => {
        const panel = document.querySelector('[role="dialog"], div[role="main"]');
        return panel ? panel.textContent || '' : '';
      });

      const phoneMatch = allText.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
      if (phoneMatch) {
        return leadNormalizer.normalizePhone(phoneMatch[0]);
      }
    } catch {
      // ignore
    }

    return undefined;
  }

  private async extractAddress(page: Page): Promise<string | undefined> {
    const selectors = [
      'button[data-item-id*="address"]',
      'div[aria-label*="address"]',
      'span[aria-label*="address"]',
    ];

    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const text = await el.textContent().catch(() => null) ||
                     await el.getAttribute('aria-label').catch(() => null);
        if (text && text.length > 5) return text.trim();
      }
    }

    return undefined;
  }

  private extractPincode(text: string): string | undefined {
    const match = text.match(/\b(\d{6})\b/);
    return match ? match[1] : undefined;
  }

  private async scrollFeed(page: Page): Promise<void> {
    try {
      const feed = await page.$('[role="feed"]');
      if (feed) {
        await page.evaluate(() => {
          const el = document.querySelector('[role="feed"]');
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        });
        return;
      }

      await page.evaluate(() => {
        const main = document.querySelector('div[role="main"]');
        if (main) {
          main.scrollTop = main.scrollHeight;
        } else {
          window.scrollBy(0, 600);
        }
      });
    } catch {
      await page.evaluate(() => window.scrollBy(0, 400)).catch(() => {});
    }
  }

  private async scrollFeedAggressive(page: Page): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await this.scrollFeed(page);
      await page.waitForTimeout(500);
    }
  }
}


//Path = /run/media/ritesh/Project Data/AI Projects/Lead Finder Agent/backend/src/core/scraper-engine/sources/googleMaps/scraper.ts