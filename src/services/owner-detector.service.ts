import { logger } from '../utils/logger';
import { PlaywrightBrowser } from '../scrapers/browser-manager';

export interface OwnerInfo {
  name: string;
  role: string;
  confidence: number;
  source: string;
}

export interface OwnerDetectionResult {
  ownerNames: string[];
  founders: OwnerInfo[];
  ceo?: OwnerInfo;
  management: OwnerInfo[];
  extractionTime: number;
}

export class OwnerDetectorService {
  private browserManager: PlaywrightBrowser | null = null;

  /**
   * Detect owner/founder from website content
   */
  async detectOwner(website: string): Promise<OwnerDetectionResult> {
    const startTime = Date.now();
    const result: OwnerDetectionResult = {
      ownerNames: [],
      founders: [],
      management: [],
      extractionTime: 0,
    };

    try {
      if (!this.browserManager) {
        this.browserManager = new (await import('../scrapers/browser-manager.js')).PlaywrightBrowser();
      }

      const manager = this.browserManager!;
      const { page } = await manager.initialize();
      page.setDefaultTimeout(15000);

      let url = website;
      if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
      }

      const aboutPage = await this.findAboutPage(page, url);
      const targetUrl = aboutPage || url;

      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      const ownerData = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const metaTitle = document.querySelector('title')?.innerText || '';
        const h1 = document.querySelector('h1')?.innerText || '';
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

        return {
          text,
          metaTitle,
          h1,
          metaDescription,
        };
      });

      await manager.close();

      // Extract owner names from content
      const { founders, ceo, management } = this.parseOwnerNames(ownerData);
      
      result.founders = founders;
      result.ceo = ceo;
      result.management = management;
      result.ownerNames = [
        ...founders.map(f => f.name),
        ...management.map(m => m.name),
        ...(ceo ? [ceo.name] : []),
      ];

      // Remove duplicates
      result.ownerNames = [...new Set(result.ownerNames)];

    } catch (error: any) {
      logger.error(`Owner detection failed for ${website}:`, error);
    }

    result.extractionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Find about page URL
   */
  private async findAboutPage(page: any, baseUrl: string): Promise<string | null> {
    const aboutPaths = [
      '/about',
      '/about-us',
      '/about-me',
      '/founders',
      '/team',
      '/our-team',
      '/company',
      '/leadership',
      '/executive-team',
      '/board',
      '/management',
    ];

    for (const path of aboutPaths) {
      try {
        const url = baseUrl.replace(/\/+$/, '') + path;
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        
        if (response && response.status() === 200) {
          return url;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Parse owner names from content
   */
  private parseOwnerNames(content: {
    text: string;
    metaTitle: string;
    h1: string;
    metaDescription: string;
  }): {
    founders: OwnerInfo[];
    ceo?: OwnerInfo;
    management: OwnerInfo[];
  } {
    const founders: OwnerInfo[] = [];
    const management: OwnerInfo[] = [];
    let ceo: OwnerInfo | undefined;

    // Combined text to search
    const text = content.text + ' ' + content.metaTitle + ' ' + content.h1;

    // Patterns for founder mentions
    const founderPatterns = [
      { regex: /founder[:\s]+([A-Z][a-z]+)/gi, role: 'Founder' },
      { regex: /founded by[:\s]+([A-Z][a-z]+)/gi, role: 'Founder' },
      { regex: /created by[:\s]+([A-Z][a-z]+)/gi, role: 'Founder' },
      { regex: /established by[:\s]+([A-Z][a-z]+)/gi, role: 'Founder' },
      { regex: /president[:\s]+([A-Z][a-z]+)/gi, role: 'President' },
      { regex: /chairman[:\s]+([A-Z][a-z]+)/gi, role: 'Chairman' },
      { regex: /ceo[:\s]+([A-Z][a-z]+)/gi, role: 'CEO' },
    ];

    for (const pattern of founderPatterns) {
      const matches = text.match(pattern.regex);
      if (matches) {
        for (const match of matches) {
          const nameMatch = match.match(/[A-Z][a-z]+/);
          if (nameMatch) {
            const info: OwnerInfo = {
              name: nameMatch[0],
              role: pattern.role,
              confidence: 0.8,
              source: 'text_pattern',
            };

            if (pattern.role === 'CEO') {
              ceo = info;
            } else if (pattern.role === 'Founder') {
              founders.push(info);
            } else {
              management.push(info);
            }
          }
        }
      }
    }

    // Try to extract from footer
    const footerPattern = /copyright.*?©?\s*([A-Z][a-z]+)/gi;
    const footerMatches = text.match(footerPattern);
    if (footerMatches) {
      for (const match of footerMatches) {
        const nameMatch = match.match(/[A-Z][a-z]+/);
        if (nameMatch) {
          const existing = founders.find(f => f.name === nameMatch[0]);
          if (!existing) {
            founders.push({
              name: nameMatch[0],
              role: 'Founder',
              confidence: 0.6,
              source: 'footer',
            });
          }
        }
      }
    }

    // Remove duplicates
    const seen = new Set<string>();
    const uniqueFounders: OwnerInfo[] = [];
    for (const founder of founders) {
      if (!seen.has(founder.name)) {
        seen.add(founder.name);
        uniqueFounders.push(founder);
      }
    }

    return {
      founders: uniqueFounders,
      ceo,
      management,
    };
  }

  /**
   * Extract owner info from about page content
   */
  async extractFromAboutPage(
    content: string,
    _url: string
  ): Promise<OwnerInfo[]> {
    const owners: OwnerInfo[] = [];

    // Pattern for "About [Name]" or "[Name] - [Role]"
    const patterns = [
      /about\s+([A-Z][a-z]+)/gi,
      /([A-Z][a-z]+)\s+-\s+(founder|ceo|owner|president)/gi,
      /([A-Z][a-z]+)\s+is\s+a\s+(founder|ceo|owner|president)/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const nameMatch = match.match(/[A-Z][a-z]+/);
          if (nameMatch) {
            owners.push({
              name: nameMatch[0],
              role: 'Unknown',
              confidence: 0.5,
              source: 'about_page',
            });
          }
        }
      }
    }

    return owners;
  }
}

export const ownerDetectorService = new OwnerDetectorService();
