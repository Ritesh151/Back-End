import { Page } from 'playwright';
import { logger } from '../../utils/logger';
import { BaseSource, SourceOptions, ScrapingResult, LeadData } from '../../source-core/base-source';
import { SourceConfig } from '../../source-core/source-config';
import { scrapingProgress } from '../../services/scraping-progress';
import { searchQueryBuilder } from '../../services/search-query-builder';
import { businessRelevanceValidator } from '../../services/business-relevance-validator';
import { browserPool } from '../../services/browser-pool.service';

export class JustdialSource extends BaseSource {
  constructor(config?: Partial<SourceConfig>) {
    super('justdial', config);
  }

  async scrape(options: SourceOptions): Promise<ScrapingResult> {
    const { keyword, location = '', state, city, area, businessType, sessionId: providedSessionId } = options;
    const sessionId = providedSessionId || scrapingProgress.generateSessionId();

    const queries = searchQueryBuilder.build({
      businessType: businessType || keyword,
      state,
      city,
      area,
      sources: ['justdial'],
    });
    const sourceQuery = queries[0];
    const searchUrl = sourceQuery?.url || `https://www.justdial.com/search?q=${encodeURIComponent(keyword)}`;
    const fullSearchQuery = sourceQuery?.fullSearchQuery || keyword;

    scrapingProgress.createSession(sessionId, {
      keyword,
      location: location || '',
      area: area || '',
      city: city || '',
      state: state || '',
      businessType: businessType || keyword,
    });

    logger.info({
      keyword, state, city, area, businessType,
      searchUrl, sessionId,
    }, 'JustdialSource: Starting scrape');

    if (!keyword || keyword.trim().length === 0) {
      logger.error({}, 'JustdialSource: Empty keyword provided');
      return {
        success: false,
        message: 'Invalid keyword: keyword is required',
        totalExtracted: 0,
        totalStored: 0,
        totalDuplicates: 0,
        leads: [],
      };
    }

    const allLeads: LeadData[] = [];
    const allScrapedNames = new Set<string>();

    const poolResource = await browserPool.acquire('justdial');
    const page = poolResource.page;

    try {
      page.setDefaultTimeout(30000);

      logger.info({ url: searchUrl, sessionId }, 'JustdialSource: Navigating');
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      let stalledCount = 0;
      const MAX_STALLED = 15;

      while (stalledCount < MAX_STALLED) {
        const newLeads = await this.extractVisibleBusinesses(page, allScrapedNames);

        if (newLeads.length === 0) {
          stalledCount++;
          await this.scrollPage(page);
          await page.waitForTimeout(2000);
          continue;
        }

        stalledCount = 0;

        for (const lead of newLeads) {
          const dupKey = `${lead.companyName}|${lead.phone || lead.address || ''}`;
          if (allScrapedNames.has(dupKey)) continue;
          allScrapedNames.add(dupKey);

          scrapingProgress.incrementScraped(sessionId);

          const relevance = businessRelevanceValidator.validate(
            lead.companyName,
            lead.category,
            businessType || keyword
          );

          if (!relevance.relevant || relevance.score < 25) {
            scrapingProgress.incrementRejected(sessionId);
            logger.info({ business: lead.companyName, reason: 'relevance_low', score: relevance.score }, 'JustdialSource: Rejected');
            continue;
          }

          if (area) {
            const locCheck = businessRelevanceValidator.validateLocation(
              lead.address,
              area,
              city,
              state
            );
            if (!locCheck.relevant) {
              scrapingProgress.incrementRejected(sessionId);
              logger.info({ business: lead.companyName, reason: 'area_mismatch' }, 'JustdialSource: Rejected');
              continue;
            }
            lead.locationRelevanceScore = locCheck.score;
          }

          lead.relevanceScore = relevance.score;
          lead.validatedCategory = relevance.validatedCategory;
          lead.source = 'justdial';
          lead.sourceUrl = searchUrl;
          lead.leadScore = this.calculateLeadScore(lead);

          const stored = await this.storeLeads([lead], {
            keyword,
            location: area || location,
            area,
            city,
            state,
            businessType: businessType || keyword,
            fullSearchQuery,
          });

          if (stored.totalStored > 0) {
            scrapingProgress.incrementSaved(sessionId);
            allLeads.push(lead);
            logger.info({ company: lead.companyName, sessionId }, 'JustdialSource: Lead saved');
          } else if (stored.totalDuplicates > 0) {
            scrapingProgress.incrementDuplicates(sessionId);
            logger.info({ company: lead.companyName }, 'JustdialSource: Duplicate skipped');
          }
        }

        await this.scrollPage(page);
        await page.waitForTimeout(2000);
      }

      scrapingProgress.completeSession(sessionId);

      logger.info({
        sessionId,
        totalFound: allScrapedNames.size,
        totalSaved: allLeads.length,
      }, 'JustdialSource: Scrape completed');

      return {
        success: allLeads.length > 0,
        message: allLeads.length > 0
          ? `Justdial completed: ${allLeads.length} saved`
          : 'No relevant businesses found on Justdial',
        totalExtracted: allScrapedNames.size,
        totalStored: allLeads.length,
        totalDuplicates: scrapingProgress.getProgress(sessionId)?.totalDuplicates || 0,
        leads: allLeads,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      scrapingProgress.failSession(sessionId, errMsg);
      logger.error({
        err: errMsg,
        keyword, location, sessionId,
        partialStored: allLeads.length,
      }, 'JustdialSource: Failed');
      return {
        success: allLeads.length > 0,
        message: allLeads.length > 0
          ? `Justdial completed with warnings: stored ${allLeads.length} leads`
          : `Justdial failed: ${errMsg}`,
        totalExtracted: allScrapedNames.size,
        totalStored: allLeads.length,
        totalDuplicates: 0,
        leads: allLeads,
      };
    } finally {
      await browserPool.release(page, 'justdial');
    }
  }

  private async extractVisibleBusinesses(
    page: Page,
    existingNames: Set<string>
  ): Promise<LeadData[]> {
    try {
      return await page.evaluate(
        ({ known }: { known: string[] }) => {
          const leads: LeadData[] = [];
          const nameFilter = new Set(known);

          const selectors = [
            'li[data-result-index]',
            '.jca-widget',
            '.cntanr',
            '.bshapp',
            '.store-block',
            'div[class*="result"]',
            'section[class*="result"]',
            '.card-list li',
            '.search-result li',
            '.list_part',
            '.jbho',
            '.jglink',
          ];

          let cards: Element[] = [];
          for (const sel of selectors) {
            const found = document.querySelectorAll(sel);
            if (found.length > 0) {
              cards = Array.from(found);
              break;
            }
          }

          if (cards.length === 0) {
            cards = Array.from(document.querySelectorAll('a[href*="justdial.com"][class*="name"], h2, h3, .lng_cont_name, .jcn'));
          }

          for (const card of cards) {
            const nameEl = card.querySelector(
              'h2, h3, .lng_cont_name, .jcn, [class*="name"], [class*="title"], .store-name, a[href*="justdial.com"]'
            );
            const name = nameEl?.textContent?.trim() || '';
            if (!name || name.length < 2) continue;

            const phoneEl = card.querySelector(
              'a[href^="tel:"], .contact-info, [class*="phone"], [class*="contact"], [class*="mob"]'
            );
            let phone = '';
            if (phoneEl) {
              const hrefPhone = phoneEl.getAttribute('href')?.replace('tel:', '') || '';
              const textPhone = phoneEl.textContent?.trim() || '';
              phone = hrefPhone || textPhone;
            }
            if (!phone) {
              const allText = card.textContent || '';
              const phoneMatch = allText.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
              if (phoneMatch) phone = phoneMatch[0].replace(/[\s-]/g, '');
            }

            const websiteEl = card.querySelector(
              'a[href^="http"]:not([href*="justdial.com"]):not([href*="facebook"]):not([href*="instagram"]):not([href*="youtube"]), .web-domain, [class*="website"]'
            );
            let website = websiteEl?.getAttribute('href') || '';
            if (!website) {
              const allText = card.textContent || '';
              const webMatch = allText.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/);
              if (webMatch && !webMatch[0].includes('justdial')) website = webMatch[0];
            }

            const addressEl = card.querySelector(
              '.cont_sw_addr, .address, [class*="address"], .cns_address, .addr'
            );
            const address = addressEl?.textContent?.trim() || '';

            const ratingEl = card.querySelector(
              '.green-box, [class*="rating"], .jdicon, [class*="star"]'
            );
            let rating = 0;
            if (ratingEl) {
              const ratingText = ratingEl.textContent || '';
              const m = ratingText.match(/(\d+\.?\d*)/);
              if (m) rating = parseFloat(m[1]);
            }

            const categoryEl = card.querySelector(
              '.cns_jc_cat, [class*="category"], .cat, [class*="type"]'
            );
            const category = categoryEl?.textContent?.trim() || '';

            const hrefEl = card.querySelector('a[href*="justdial.com"]');
            const href = hrefEl?.getAttribute('href') || '';
            const fullUrl = href.startsWith('http') ? href : `https://www.justdial.com${href}`;

            const dupKey = `${name}|${phone || address || ''}`;
            if (nameFilter.has(dupKey)) continue;
            nameFilter.add(dupKey);

            leads.push({
              id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              companyName: name,
              phone: phone || undefined,
              website: website || undefined,
              address: address || undefined,
              category: category || undefined,
              rating: rating || undefined,
              reviewsCount: 0,
              source: 'justdial',
              sourceUrl: fullUrl || undefined,
              createdAt: new Date().toISOString(),
            } as LeadData);
          }

          return leads;
        },
        { known: Array.from(existingNames) }
      );
    } catch (error: unknown) {
      logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'JustdialSource: extractVisibleBusinesses failed');
      return [];
    }
  }

  private async scrollPage(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        const selectors = ['.result-list', '.search-result', '.card-list', 'main', '[role="main"]', '.list_part'];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            el.scrollTop = el.scrollHeight;
            return;
          }
        }
        window.scrollBy(0, 800);
      });
    } catch {
      await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
    }
  }
}
