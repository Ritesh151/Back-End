import { Page } from 'playwright';
import { logger } from '../../../../utils/logger';
import { browserManager } from '../../browser-manager';
import { leadStorage } from '../../lead-storage';
import { searchStatus } from '../../../../services/search-status.service';
import { ScraperLead, ScraperResult, ScraperOptions } from '../../types';

const MAX_STALLED = 30;
const SCROLL_WAIT_MS = 2000;

const MENU_ITEM_PATTERNS = [
  'manchurian', 'tandoori', 'paneer', 'butter', 'chicken', 'mutton',
  'curry', 'biryani', 'roti', 'naan', 'paratha', 'rice', 'dal',
  'soup', 'salad', 'dessert', 'ice cream', 'shake', 'juice',
  'starter', 'main course', 'sizzler', 'pizza', 'pasta', 'burger',
  'sandwich', 'roll', 'noodles', 'fried rice', 'spring roll',
  'chilli', 'masala', 'kebab', 'tikka', 'kofta', 'korma',
  'lassi', 'chai', 'coffee', 'cold drink', 'soft drink',
];

function isMenuItem(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (lower.length < 6) return true;
  for (const pattern of MENU_ITEM_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }
  if (/^\d+\s/.test(lower)) return true;
  if (/^(Rs\.?|₹)/.test(lower)) return true;
  return false;
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class JustDialScraper {
  private allLeads: ScraperLead[] = [];
  private allScrapedNames = new Set<string>();

  async scrape(options: ScraperOptions & { semanticKeyword?: string }): Promise<ScraperResult> {
    const { keyword, location = '', state, city, area, businessType, sessionId, semanticKeyword } = options;

    if (!keyword || keyword.trim().length === 0) {
      return {
        success: false, message: 'Invalid keyword', totalExtracted: 0,
        totalStored: 0, totalDuplicates: 0, leads: [], sourceResults: [],
      };
    }

    const citySlug = city ? city.toLowerCase().replace(/\s+/g, '-') : '';
    const areaSlug = area ? area.toLowerCase().replace(/\s+/g, '-') : '';
    const businessSlug = (businessType || keyword).toLowerCase().replace(/\s+/g, '-');

    let searchUrl: string;
    if (city) {
      searchUrl = area
        ? `https://www.justdial.com/${citySlug}/${businessSlug}-in-${areaSlug}`
        : `https://www.justdial.com/${citySlug}/${businessSlug}`;
    } else {
      searchUrl = `https://www.justdial.com/search?q=${encodeURIComponent(keyword)}`;
    }

    this.allLeads = [];
    this.allScrapedNames = new Set();

    // JustDial requires Firefox (Chromium gets ERR_HTTP2_PROTOCOL_ERROR)
    const { page } = await browserManager.acquire('justdial', 'firefox');

    try {
      logger.info({
        url: searchUrl, keyword, city, area, sessionId,
      }, 'JustDial: Navigating');

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(randomDelay(3000, 5000));

      let stalledCount = 0;

      while (stalledCount < MAX_STALLED) {
        const newLeads = await this.extractVisibleBusinesses(page);

        const validLeads = newLeads.filter(l => {
          if (isMenuItem(l.companyName)) return false;
          const dupKey = `${l.companyName}|${l.phone || l.address || ''}`;
          if (this.allScrapedNames.has(dupKey)) return false;
          return true;
        });

        if (validLeads.length === 0) {
          stalledCount++;
          await this.scrollPage(page);
          await page.waitForTimeout(SCROLL_WAIT_MS);
          continue;
        }

        stalledCount = 0;

        for (const lead of validLeads) {
          const dupKey = `${lead.companyName}|${lead.phone || lead.address || ''}`;
          if (!this.allScrapedNames.has(dupKey)) {
            this.allScrapedNames.add(dupKey);
            if (options.sessionId) {
              searchStatus.incrementFound(options.sessionId);
            }
          }

          const stored = await leadStorage.storeLeads([lead], {
            keyword,
            location: area || location,
            area,
            city,
            state,
            businessType: businessType || keyword,
            semanticKeyword,
            sessionId: options.sessionId,
          });

          if (stored.totalStored > 0) {
            this.allLeads.push(lead);
          }
        }

        await this.scrollPage(page);
        await page.waitForTimeout(SCROLL_WAIT_MS);
      }

      return {
        success: this.allLeads.length > 0,
        message: this.allLeads.length > 0
          ? `JustDial completed: ${this.allLeads.length} leads saved`
          : 'No leads found on JustDial',
        totalExtracted: this.allScrapedNames.size,
        totalStored: this.allLeads.length,
        totalDuplicates: 0,
        leads: this.allLeads,
        sourceResults: [{
          source: 'justdial',
          totalStored: this.allLeads.length,
          totalExtracted: this.allScrapedNames.size,
          totalDuplicates: 0,
          success: this.allLeads.length > 0,
        }],
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown JustDial error';
      logger.error({ err: errMsg, keyword, sessionId }, 'JustDial: Failed');

      return {
        success: this.allLeads.length > 0,
        message: this.allLeads.length > 0
          ? `JustDial completed with warnings: ${this.allLeads.length} leads`
          : `JustDial failed: ${errMsg}`,
        totalExtracted: this.allScrapedNames.size,
        totalStored: this.allLeads.length,
        totalDuplicates: 0,
        leads: this.allLeads,
        sourceResults: [{
          source: 'justdial',
          totalStored: this.allLeads.length,
          totalExtracted: this.allScrapedNames.size,
          totalDuplicates: 0,
          success: this.allLeads.length > 0,
          error: this.allLeads.length > 0 ? undefined : errMsg,
        }],
      };
    } finally {
      await browserManager.release(page, 'justdial');
    }
  }

  private async extractVisibleBusinesses(page: Page): Promise<ScraperLead[]> {
    try {
      return await page.evaluate(() => {
        const leads: ScraperLead[] = [];

        const resultBoxes = document.querySelectorAll('div[class*="resultbox"]');

        for (let i = 0; i < resultBoxes.length; i++) {
            const box = resultBoxes[i];
          const text = box.textContent || '';

          const nameEl = box.querySelector('.font22, span[class*="font22"], [class*="store_name"], .lng_cont_name, h2');
          const name = nameEl?.textContent?.trim() || '';
          if (!name || name.length < 3) continue;

          const telLink = box.querySelector('a[href^="tel:"]');
          let phone = telLink?.getAttribute('href')?.replace('tel:', '') || '';
          if (!phone) {
            const callAnchor = box.querySelector('.callNowAnchor, a[class*="call"], [class*="callNow"]');
            if (callAnchor) {
              phone = callAnchor.textContent?.trim() || '';
              phone = phone.replace(/^Call\s+/i, '').replace(/[\s-]/g, '');
            }
          }
          if (!phone) {
            const pm = text.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
            if (pm) phone = pm[0].replace(/[\s-]/g, '');
          }

          const addrEl = box.querySelector('.cont_fload, [class*="address"], .mre-dir, [class*="add"]');
          const address = addrEl?.textContent?.trim() || '';

          const ratingEl = box.querySelector('[class*="rating"], .green-box, .star, [class*="green"]');
          let rating = 0;
          if (ratingEl) {
            const rm = (ratingEl.textContent || '').match(/(\d+\.?\d*)/);
            if (rm) rating = parseFloat(rm[1]);
          }

          const hrefEl = box.querySelector('a[href*="justdial.com"]');
          const href = hrefEl?.getAttribute('href') || '';
          const sourceUrl = href.startsWith('http') ? href : `https://www.justdial.com${href}`;

          const websiteEl = box.querySelector('a[href^="http"]:not([href*="justdial.com"]):not([href*="facebook"]):not([href*="instagram"])');
          const website = websiteEl?.getAttribute('href') || undefined;

          if (phone || name.toLowerCase().includes('restaurant') || name.toLowerCase().includes('hotel')) {
            leads.push({
              companyName: name,
              phone: phone || undefined,
              website,
              address: address || undefined,
              rating: rating > 0 && rating < 10 ? rating : undefined,
              source: 'justdial',
              sourceUrl: sourceUrl || undefined,
            });
          }
        }

        if (leads.length === 0) {
          const allBoxes = document.querySelectorAll('div[class*="result"], section[class*="result"]');
          for (let i = 0; i < allBoxes.length; i++) {
            const box = allBoxes[i];
            const text = box.textContent || '';
            const nameEl = box.querySelector('.font22, span[class*="store"], h2, h3, [class*="name"]');
            const name = nameEl?.textContent?.trim() || '';
            if (!name || name.length < 3) continue;

            const pm = text.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
            const phone = pm ? pm[0].replace(/[\s-]/g, '') : '';

            const addr = box.querySelector('[class*="address"]')?.textContent?.trim() || '';

            leads.push({
              companyName: name,
              phone: phone || undefined,
              address: addr || undefined,
              source: 'justdial',
            });
          }
        }

        return leads;
      });
    } catch {
      return [];
    }
  }

  private async scrollPage(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        const selectors = [
          '.result-list', '[class*="result_list"]', '.search-result',
          '.card-list', 'main', '[role="main"]', '.list_part',
          '.jbd', '.jbt', 'body',
        ];
        for (let i = 0; i < selectors.length; i++) {
          const sel = selectors[i];
          const el = document.querySelector(sel);
          if (el) {
            el.scrollTop = el.scrollHeight;
            return;
          }
        }
        window.scrollBy(0, 600);
      });
    } catch {
      await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
    }
  }
}
