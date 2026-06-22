import { logger } from '../utils/logger';
import { PlaywrightBrowser } from '../scrapers/browser-manager';

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  images: string[];
  metadata: {
    metaTitle?: string;
    metaDescription?: string;
    h1?: string;
    h2?: string[];
  };
  extractionTime: number;
}

export interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  timeout?: number;
  followExternalLinks?: boolean;
}

export class WebsiteCrawlerService {
  private browserManager: PlaywrightBrowser | null = null;

  constructor() {
    this.browserManager = null;
  }

  /**
   * Crawl a website and extract all pages
   */
  async crawlWebsite(
    baseUrl: string,
    options: CrawlOptions = {}
  ): Promise<{
    crawledPages: CrawlResult[];
    totalPages: number;
    crawlTime: number;
    status: 'success' | 'partial' | 'failed';
  }> {
    const startTime = Date.now();
    const crawledPages: CrawlResult[] = [];
    const visitedUrls = new Set<string>();
    const pagesToCrawl: string[] = [baseUrl];

    let currentPage = 0;
    const maxPages = options.maxPages || 10;
    const timeout = options.timeout || 15000;

    try {
      this.browserManager = new PlaywrightBrowser();

      while (pagesToCrawl.length > 0 && currentPage < maxPages) {
        const url = pagesToCrawl.shift()!;
        
        // Skip already visited or external URLs
        if (visitedUrls.has(url) || !this.isSameDomain(url, baseUrl)) {
          continue;
        }

        visitedUrls.add(url);
        currentPage++;

        logger.info(`Crawling page ${currentPage}: ${url}`);

        try {
          const result = await this.crawlSinglePage(url, timeout);
          crawledPages.push(result);

          // Add links to pages to crawl
          if (result.links.length > 0 && visitedUrls.size < maxPages) {
            for (const link of result.links) {
              if (!visitedUrls.has(link) && this.isSameDomain(link, baseUrl)) {
                pagesToCrawl.push(link);
              }
            }
          }

        } catch (error: any) {
          logger.warn(`Failed to crawl ${url}:`, error.message);
        }
      }

      return {
        crawledPages,
        totalPages: crawledPages.length,
        crawlTime: Date.now() - startTime,
        status: crawledPages.length > 0 ? 'success' : 'failed',
      };

    } catch (error: any) {
      logger.error('Website crawl failed:', error);
      return {
        crawledPages,
        totalPages: crawledPages.length,
        crawlTime: Date.now() - startTime,
        status: 'failed',
      };
    } finally {
      if (this.browserManager) {
        await this.browserManager.close();
        this.browserManager = null;
      }
    }
  }

  /**
   * Crawl a single page
   */
  private async crawlSinglePage(
    url: string,
    timeout: number
  ): Promise<CrawlResult> {
    const result: CrawlResult = {
      url,
      title: '',
      content: '',
      links: [],
      images: [],
      metadata: {},
      extractionTime: 0,
    };

    const startTime = Date.now();

    try {
      if (!this.browserManager) {
        this.browserManager = new PlaywrightBrowser();
      }

      const { page } = await this.browserManager.initialize();
      page.setDefaultTimeout(timeout);

      await page.goto(url, { waitUntil: 'networkidle', timeout });
      await page.waitForTimeout(1000); // Allow content to load

      // Extract page data
      const pageData = await page.evaluate(() => {
        const title = document.title || '';
        const content = document.body.innerText || '';
        const links: string[] = [];
        const images: string[] = [];

        // Extract links
        document.querySelectorAll('a').forEach(el => {
          const href = el.getAttribute('href');
          if (href) {
            links.push(href);
          }
        });

        // Extract images
        document.querySelectorAll('img').forEach(el => {
          const src = el.getAttribute('src');
          if (src) {
            images.push(src);
          }
        });

        // Extract metadata
        const metaTitle = document.querySelector('meta[name="title"]')?.getAttribute('content') || '';
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const h1 = document.querySelector('h1')?.innerText || '';
        const h2: string[] = [];
        document.querySelectorAll('h2').forEach(el => {
          h2.push(el.innerText);
        });

        return {
          title,
          content,
          links,
          images,
          metadata: {
            metaTitle,
            metaDescription,
            h1,
            h2,
          },
        };
      });

      result.title = pageData.title;
      result.content = pageData.content;
      result.links = pageData.links;
      result.images = pageData.images;
      result.metadata = pageData.metadata;

      result.extractionTime = Date.now() - startTime;

      await this.browserManager.close();

    } catch (error: any) {
      logger.warn(`Failed to crawl page ${url}:`, error.message);
    }

    return result;
  }

  /**
   * Check if URL is same domain
   */
  private isSameDomain(url: string, baseUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseObj = new URL(baseUrl);
      return urlObj.hostname === baseObj.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Crawl and extract contact info from pages
   */
  async crawlAndExtractContacts(
    baseUrl: string,
    options: CrawlOptions = {}
  ): Promise<{
    emails: string[];
    phones: string[];
    socialLinks: any;
    crawledPages: CrawlResult[];
  }> {
    const { crawledPages } = await this.crawlWebsite(baseUrl, options);

    const emails: string[] = [];
    const phones: string[] = [];
    const socialLinks: any = {};

    // Extract from all crawled pages
    for (const page of crawledPages) {
      // Extract emails
      const emailMatches = page.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emailMatches) {
        emails.push(...emailMatches);
      }

      // Extract phones
      const phoneMatches = page.content.match(/\+?[\d\s\-\(\)]{10,}/g);
      if (phoneMatches) {
        phones.push(...phoneMatches);
      }

      // Extract social links
      for (const link of page.links) {
        const lowerLink = link.toLowerCase();
        if (lowerLink.includes('facebook.com') && !socialLinks.facebook) {
          socialLinks.facebook = link;
        }
        if (lowerLink.includes('instagram.com') && !socialLinks.instagram) {
          socialLinks.instagram = link;
        }
        if (lowerLink.includes('linkedin.com') && !socialLinks.linkedin) {
          socialLinks.linkedin = link;
        }
        if (lowerLink.includes('twitter.com') || lowerLink.includes('x.com')) {
          if (!socialLinks.twitter) socialLinks.twitter = link;
        }
      }
    }

    return {
      emails: [...new Set(emails)],
      phones: [...new Set(phones)],
      socialLinks,
      crawledPages,
    };
  }
}

export const websiteCrawlerService = new WebsiteCrawlerService();
