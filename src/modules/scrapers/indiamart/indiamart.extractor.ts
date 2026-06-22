import { Page } from 'playwright';
import { logger } from '../../../utils/logger';
import type { IndiaMartRawListing } from './indiamart.types';
import { INDIA_MART_SEARCH_URL, isGenericSuggestion } from './indiamart.types';
import { parseListingPage } from './indiamart.parser';

const SCROLL_WAIT_MS = 2500;
const MAX_STALLED = 15;
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const SEARCH_URLS = [
  (query: string) => `${INDIA_MART_SEARCH_URL}?ss=${encodeURIComponent(query)}`,
  (query: string) => `${INDIA_MART_SEARCH_URL}?ss=${encodeURIComponent(query)}&v=2`,
  (query: string) => `${INDIA_MART_SEARCH_URL}?ss=${encodeURIComponent(query)}&city=`,
];

export async function extractListings(
  page: Page,
  keyword: string,
  city?: string,
  area?: string
): Promise<IndiaMartRawListing[]> {
  const query = [keyword, area, city].filter(Boolean).join(' ');
  const allListings: IndiaMartRawListing[] = [];
  const existingNames = new Set<string>();

  for (const urlBuilder of SEARCH_URLS) {
    const searchUrl = urlBuilder(query);

    logger.info({
      url: searchUrl, keyword, city, area,
    }, 'IndiaMartExtractor: Navigating search URL');

    try {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      });

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(randomDelay(2000, 4000));

      const hasResults = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        return text.includes('Contact Supplier') || text.includes('Send Enquiry');
      });

      if (!hasResults) {
        logger.info({ url: searchUrl }, 'IndiaMartExtractor: No results on this URL variant');
        continue;
      }

      const listingsFromUrl = await processSearchPage(page, existingNames);
      allListings.push(...listingsFromUrl);

      if (allListings.length > 0) {
        break;
      }
    } catch (err) {
      logger.warn({
        err: err instanceof Error ? err.message : String(err),
        url: searchUrl,
      }, 'IndiaMartExtractor: URL attempt failed');
    }
  }

  logger.info({
    totalListings: allListings.length,
    keyword, city, area,
  }, 'IndiaMartExtractor: Completed');

  return allListings;
}

async function processSearchPage(
  page: Page,
  existingNames: Set<string>
): Promise<IndiaMartRawListing[]> {
  const allListings: IndiaMartRawListing[] = [];
  let stalledCount = 0;

  while (stalledCount < MAX_STALLED) {
    const html = await page.content();
    const newListings = parseListingPage(html, existingNames);

    const validListings = newListings.filter(l => {
      if (isGenericSuggestion(l.companyName)) return false;
      const key = `${l.companyName}|${l.listingId}`;
      if (existingNames.has(key)) return false;
      existingNames.add(key);
      return true;
    });

    if (validListings.length === 0) {
      stalledCount++;
      await scrollPage(page);
      await page.waitForTimeout(SCROLL_WAIT_MS);
      continue;
    }

    stalledCount = 0;
    allListings.push(...validListings);

    logger.info({
      newFound: validListings.length,
      totalFound: allListings.length,
      stalledCount,
    }, 'IndiaMartExtractor: New listings found');

    await scrollPage(page);
    await page.waitForTimeout(randomDelay(1500, 3000));
  }

  return allListings;
}

async function scrollPage(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const selectors = [
        '.product-listing', '.search-result', '.listing', 'main',
        '[role="main"]', '.list-view', '.prd-lst', '.srch-result',
        '.listingPage', '.srch_product_box_container', 'body',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const prev = el.scrollTop;
          el.scrollTop = el.scrollHeight;
          if (el.scrollTop === prev) {
            el.scrollTop += 600;
          }
          return;
        }
      }
      window.scrollBy(0, 800);
    });

    await page.evaluate(() => {
      const loadMore = document.querySelector('a.load-more, button.load-more, [class*="loadMore"], [class*="load_more"], .pagination a.next');
      if (loadMore instanceof HTMLElement) {
        loadMore.click();
      }
    });
  } catch {
    await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
  }
}
