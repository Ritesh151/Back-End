import { logger } from '../utils/logger';
import { extractEmails, extractPhones, normalizePhone } from '../utils/contact-extraction';
import { PlaywrightBrowser } from '../scrapers/browser-manager';

export interface ContactExtractionResult {
  emails: string[];
  phones: string[];
  socialLinks: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
  };
  contactPages: string[];
  ownerNames: string[];
  websitePagesCrawled: string[];
  extractionStatus: 'success' | 'partial' | 'failed';
  extractionTime: number;
  extractionError?: string;
}

export interface ExtractionOptions {
  maxDepth?: number;
  maxPages?: number;
  timeout?: number;
  followExternalLinks?: boolean;
}

export class ContactExtractorService {
  private browserManager: PlaywrightBrowser | null = null;

  constructor() {
    this.browserManager = null;
  }

  /**
   * Extract contacts from a single website
   */
  async extractContacts(
    website: string,
    options: ExtractionOptions = {}
  ): Promise<ContactExtractionResult> {
    const startTime = Date.now();
    const result: ContactExtractionResult = {
      emails: [],
      phones: [],
      socialLinks: {},
      contactPages: [],
      ownerNames: [],
      websitePagesCrawled: [],
      extractionStatus: 'success',
      extractionTime: 0,
    };

    try {
      // Normalize website URL
      let normalizedUrl = this.normalizeUrl(website);
      if (!normalizedUrl) {
        result.extractionStatus = 'failed';
        result.extractionError = 'Invalid website URL';
        return result;
      }

      // Initialize browser if needed
      if (!this.browserManager) {
        this.browserManager = new PlaywrightBrowser();
      }

      // Extract from homepage
      const homepageResult = await this.extractFromPage(normalizedUrl, options);
      result.emails.push(...homepageResult.emails);
      result.phones.push(...homepageResult.phones);
      result.socialLinks = { ...result.socialLinks, ...homepageResult.socialLinks };
      result.contactPages.push(...homepageResult.contactPages);
      result.ownerNames.push(...homepageResult.ownerNames);
      result.websitePagesCrawled.push(normalizedUrl);

      // Check for contact page and extract
      const contactPageUrl = await this.detectContactPage(normalizedUrl);
      if (contactPageUrl) {
        const contactResult = await this.extractFromPage(contactPageUrl, options);
        result.emails.push(...contactResult.emails);
        result.phones.push(...contactResult.phones);
        result.socialLinks = { ...result.socialLinks, ...contactResult.socialLinks };
        result.ownerNames.push(...contactResult.ownerNames);
        result.websitePagesCrawled.push(contactPageUrl);
      }

      // Check for about page
      const aboutPageUrl = await this.detectAboutPage(normalizedUrl);
      if (aboutPageUrl && aboutPageUrl !== contactPageUrl) {
        const aboutResult = await this.extractFromPage(aboutPageUrl, options);
        result.ownerNames.push(...aboutResult.ownerNames);
        result.websitePagesCrawled.push(aboutPageUrl);
      }

      // Deduplicate and clean
      result.emails = this.deduplicate(result.emails);
      result.phones = this.deduplicate(result.phones).map(normalizePhone);

      result.extractionTime = Date.now() - startTime;

      // Determine status
      if (result.emails.length === 0 && result.phones.length === 0) {
        result.extractionStatus = 'partial';
      }

      logger.info(`Contact extraction completed for ${website}: ${result.emails.length} emails, ${result.phones.length} phones`);

    } catch (error: any) {
      logger.error(`Contact extraction failed for ${website}:`, error);
      result.extractionStatus = 'failed';
      result.extractionError = error.message;
    }

    return result;
  }

  /**
   * Bulk extract contacts from multiple leads
   */
  async bulkExtractContacts(
    leads: Array<{ id: string; website?: string }>,
    options: ExtractionOptions = {}
  ): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    results: Array<{ leadId: string; result: ContactExtractionResult }>;
  }> {
    const results: Array<{ leadId: string; result: ContactExtractionResult }> = [];
    let successful = 0;
    let failed = 0;

    // Process in batches of 3 to avoid overwhelming
    const batchSize = 3;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);

      const batchPromises = batch.map(async (lead) => {
        if (!lead.website) {
          failed++;
          return { leadId: lead.id, result: { extractionStatus: 'failed' as const, extractionError: 'No website', emails: [], phones: [], socialLinks: {}, contactPages: [], ownerNames: [], websitePagesCrawled: [], extractionTime: 0 } };
        }

        try {
          const result = await this.extractContacts(lead.website, options);
          if (result.extractionStatus === 'success') {
            successful++;
          } else {
            failed++;
          }
          return { leadId: lead.id, result };
        } catch (error) {
          failed++;
          return {
            leadId: lead.id,
            result: {
              extractionStatus: 'failed' as const,
              extractionError: error instanceof Error ? error.message : 'Unknown error',
              emails: [],
              phones: [],
              socialLinks: {},
              contactPages: [],
              ownerNames: [],
              websitePagesCrawled: [],
              extractionTime: 0,
            },
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      totalProcessed: leads.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Extract contacts from a single page
   */
  private async extractFromPage(
    url: string,
    options: ExtractionOptions = {}
  ): Promise<{ emails: string[]; phones: string[]; socialLinks: any; ownerNames: string[]; contactPages: string[] }> {
    const result = {
      emails: [] as string[],
      phones: [] as string[],
      socialLinks: {} as any,
      ownerNames: [] as string[],
      contactPages: [] as string[],
    };

    try {
      if (!this.browserManager) {
        this.browserManager = new PlaywrightBrowser();
      }

      const { page } = await this.browserManager.initialize();
      page.setDefaultTimeout(options.timeout || 15000);

      await page.goto(url, { waitUntil: 'networkidle', timeout: options.timeout || 15000 });

      // Get page content
      const content = await page.content();
      const $ = await import('cheerio').then(c => c.load(content));

      // Extract emails
      result.emails.push(...extractEmails(content));

      // Extract phones
      result.phones.push(...extractPhones(content));

      // Extract social links
      const socialLinks = await this.extractSocialLinks(page, url);
      result.socialLinks = socialLinks;

      // Extract owner names from about sections
      result.ownerNames.push(...this.extractOwnerNames($, content));

      await this.browserManager.close();

    } catch (error: any) {
      logger.warn(`Failed to extract from ${url}:`, error.message);
    }

    return result;
  }

  /**
   * Detect contact page URL
   */
  private async detectContactPage(baseUrl: string): Promise<string | null> {
    const contactPaths = [
      '/contact',
      '/contact-us',
      '/contact-us/',
      '/contacto',
      '/contactar',
      '/get-in-touch',
      '/reach-us',
      '/contact-form',
      '/contact-me',
    ];

    for (const path of contactPaths) {
      try {
        const url = baseUrl.replace(/\/+$/, '') + path;
        
        if (!this.browserManager) {
          this.browserManager = new PlaywrightBrowser();
        }

        if (!this.browserManager) return null;
        const { page } = await this.browserManager.initialize();
        page.setDefaultTimeout(5000);

        try {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
          if (response?.status() === 200) {
            await this.browserManager.close();
            return url;
          }
        } catch {
          // Continue to next path
        }

        await this.browserManager.close();
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Detect about page URL
   */
  private async detectAboutPage(baseUrl: string): Promise<string | null> {
    const aboutPaths = [
      '/about',
      '/about-us',
      '/about-us/',
      '/about-me',
      '/about/company',
      '/company',
      '/team',
      '/founders',
      '/our-team',
    ];

    for (const path of aboutPaths) {
      try {
        const url = baseUrl.replace(/\/+$/, '') + path;
        
        if (!this.browserManager) {
          this.browserManager = new PlaywrightBrowser();
        }

        if (!this.browserManager) return null;
        const { page } = await this.browserManager.initialize();
        page.setDefaultTimeout(5000);

        try {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
          if (response?.status() === 200) {
            await this.browserManager.close();
            return url;
          }
        } catch {
          // Continue to next path
        }

        await this.browserManager.close();
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Extract social media links
   */
  private async extractSocialLinks(page: any, _baseUrl: string): Promise<any> {
    const socialLinks: any = {};

    try {
      const content = await page.content();
      const $ = await import('cheerio').then(c => c.load(content));

      // Find all links
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!href) return;

        const lowerHref = href.toLowerCase();

        if (lowerHref.includes('facebook.com')) {
          if (!socialLinks.facebook) socialLinks.facebook = href;
        }
        if (lowerHref.includes('instagram.com')) {
          if (!socialLinks.instagram) socialLinks.instagram = href;
        }
        if (lowerHref.includes('linkedin.com')) {
          if (!socialLinks.linkedin) socialLinks.linkedin = href;
        }
        if (lowerHref.includes('twitter.com') || lowerHref.includes('x.com')) {
          if (!socialLinks.twitter) socialLinks.twitter = href;
        }
        if (lowerHref.includes('youtube.com')) {
          if (!socialLinks.youtube) socialLinks.youtube = href;
        }
      });

    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), 'Failed to extract social links:');
    }

    return socialLinks;
  }

  /**
   * Extract owner names from content
   */
  private extractOwnerNames($: any, content: string): string[] {
    const ownerNames: string[] = [];

    // Pattern for founder/owner mentions
    const patterns = [
      /founder[:\s]+([A-Z][a-z]+)/gi,
      /owner[:\s]+([A-Z][a-z]+)/gi,
      /ceo[:\s]+([A-Z][a-z]+)/gi,
      /founded by[:\s]+([A-Z][a-z]+)/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const nameMatch = match.match(/[A-Z][a-z]+/);
          if (nameMatch) {
            ownerNames.push(nameMatch[0]);
          }
        }
      }
    }

    // Try to find owner in footer
    const footer = $('footer').text() || '';
    const footerPatterns = [
      /copyright.*?([A-Z][a-z]+)/gi,
      /©([A-Z][a-z]+)/gi,
    ];

    for (const pattern of footerPatterns) {
      const matches = footer.match(pattern);
      if (matches) {
        for (const match of matches) {
          const nameMatch = match.match(/[A-Z][a-z]+/);
          if (nameMatch) {
            ownerNames.push(nameMatch[0]);
          }
        }
      }
    }

    return this.deduplicate(ownerNames).slice(0, 5); // Limit to top 5
  }

  /**
   * Normalize URL
   */
  private normalizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    let normalized = url.trim();

    // Add protocol if missing
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = 'https://' + normalized;
    }

    // Remove trailing slash for consistency
    normalized = normalized.replace(/\/+$/, '');

    try {
      new URL(normalized);
    } catch {
      return null;
    }

    return normalized;
  }

  /**
   * Deduplicate array
   */
  private deduplicate<T>(arr: T[]): T[] {
    return [...new Set(arr)];
  }
}

export const contactExtractorService = new ContactExtractorService();
