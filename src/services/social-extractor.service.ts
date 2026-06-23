import { logger } from '../utils/logger';
import { PlaywrightBrowser } from '../scrapers/browser-manager';

export interface SocialMediaLinks {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  whatsapp?: string;
  telegram?: string;
}

export interface SocialExtractionOptions {
  timeout?: number;
  maxRetries?: number;
}

export class SocialExtractorService {
  private browserManager: PlaywrightBrowser | null = null;

  /**
   * Extract social media links from a website
   */
  async extractSocialLinks(
    website: string,
    options: SocialExtractionOptions = {}
  ): Promise<SocialMediaLinks> {
    const links: SocialMediaLinks = {};
    const timeout = options.timeout || 15000;

    try {
      if (!this.browserManager) {
        this.browserManager = new (await import('../scrapers/browser-manager.js')).PlaywrightBrowser();
      }

      const manager = this.browserManager!;
      const { page } = await manager.initialize();
      page.setDefaultTimeout(timeout);

      let url = website;
      if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
      }

      await page.goto(url, { waitUntil: 'networkidle', timeout });

      await page.waitForTimeout(1000);

      // Extract social links
      const socialData = await page.evaluate(() => {
        const socialLinks: any = {};

        // Find all links
        document.querySelectorAll('a').forEach(el => {
          const href = el.getAttribute('href') || '';
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
          if (lowerHref.includes('wa.me') || lowerHref.includes('whatsapp.com')) {
            if (!socialLinks.whatsapp) socialLinks.whatsapp = href;
          }
          if (lowerHref.includes('telegram.me') || lowerHref.includes('t.me')) {
            if (!socialLinks.telegram) socialLinks.telegram = href;
          }
        });

        // Check social media meta tags
        const ogData = {
          facebook: document.querySelector('meta[property="og:facebook"]')?.getAttribute('content'),
          instagram: document.querySelector('meta[property="og:instagram"]')?.getAttribute('content'),
          linkedin: document.querySelector('meta[property="og:linkedin"]')?.getAttribute('content'),
          twitter: document.querySelector('meta[property="og:twitter"]')?.getAttribute('content'),
        };

        for (const [platform, url] of Object.entries(ogData)) {
          if (url && !socialLinks[platform]) {
            socialLinks[platform] = url;
          }
        }

        return socialLinks;
      });

      // Merge extracted links
      for (const [platform, url] of Object.entries(socialData)) {
        if (url && !links[platform as keyof SocialMediaLinks]) {
          links[platform as keyof SocialMediaLinks] = url as string;
        }
      }

      logger.info(`Social extraction completed for ${website}`);

    } catch (error: any) {
      logger.error(`Social extraction failed for ${website}:`, error);
    }

    return links;
  }

  /**
   * Extract social links from a single page (without browser)
   */
  async extractFromContent(
    content: string,
    _baseUrl: string
  ): Promise<SocialMediaLinks> {
    const links: SocialMediaLinks = {};

    try {
      const $ = await import('cheerio').then(c => c.load(content));

      // Find all links
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!href) return;

        const lowerHref = href.toLowerCase();

        if (lowerHref.includes('facebook.com') && !links.facebook) {
          links.facebook = href;
        }
        if (lowerHref.includes('instagram.com') && !links.instagram) {
          links.instagram = href;
        }
        if (lowerHref.includes('linkedin.com') && !links.linkedin) {
          links.linkedin = href;
        }
        if ((lowerHref.includes('twitter.com') || lowerHref.includes('x.com')) && !links.twitter) {
          links.twitter = href;
        }
        if (lowerHref.includes('youtube.com') && !links.youtube) {
          links.youtube = href;
        }
        if ((lowerHref.includes('wa.me') || lowerHref.includes('whatsapp.com')) && !links.whatsapp) {
          links.whatsapp = href;
        }
        if ((lowerHref.includes('telegram.me') || lowerHref.includes('t.me')) && !links.telegram) {
          links.telegram = href;
        }
      });

    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), 'Failed to extract social links from content:');
    }

    return links;
  }

  /**
   * Check if social media page is accessible
   */
  async checkSocialMediaLink(
    url: string,
    timeout: number = 5000
  ): Promise<boolean> {
    try {
      if (!this.browserManager) {
        this.browserManager = new (await import('../scrapers/browser-manager.js')).PlaywrightBrowser();
      }

      const manager = this.browserManager!;
      const { page } = await manager.initialize();
      page.setDefaultTimeout(timeout);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await manager.close();

      return true;
    } catch {
      return false;
    }
  }
}

export const socialExtractorService = new SocialExtractorService();
