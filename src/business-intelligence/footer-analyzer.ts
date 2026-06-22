import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { FooterAnalysis } from './types';

export class FooterAnalyzer {
  async analyzeFooter(html: string): Promise<FooterAnalysis> {
    try {
      const $ = cheerio.load(html);
      
      const copyrightData = await this.detectCopyright($);
      const privacyPolicy = this.detectPrivacyPolicy($);
      const termsPage = this.detectTermsPage($);
      const footerLinks = this.countFooterLinks($);
      const hasContactInfo = this.detectFooterContact($);
      
      const footerComplete = copyrightData.detected && 
                            privacyPolicy && 
                            footerLinks > 3 && 
                            hasContactInfo;

      const analysis: FooterAnalysis = {
        copyrightDetected: copyrightData.detected,
        copyrightYear: copyrightData.year,
        privacyPolicy,
        termsPage,
        footerComplete,
        footerLinks,
        hasContactInfo,
      };

      logger.info(`Footer analyzed: copyright=${copyrightData.year}, privacy=${privacyPolicy}, complete=${footerComplete}`);
      return analysis;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to analyze footer:');
      return this.getDefaultFooterAnalysis();
    }
  }

  private detectCopyright($: cheerio.CheerioAPI): { detected: boolean; year: number | null } {
    const currentYear = new Date().getFullYear();
    const footerSelectors = ['footer', '.footer', '#footer', '[role="contentinfo"]'];
    
    for (const selector of footerSelectors) {
      const footerText = $(selector).text().toLowerCase();
      
      if (footerText.includes('©') || footerText.includes('copyright')) {
        const yearMatches = footerText.match(/(?:©|copyright)\s*(?:\(c\)\s*)?(\d{4})/i);
        if (yearMatches) {
          const year = parseInt(yearMatches[1], 10);
          return { detected: true, year };
        }
        
        const yearRangeMatches = footerText.match(/(\d{4})\s*-\s*(\d{4})/);
        if (yearRangeMatches) {
          const endYear = parseInt(yearRangeMatches[2], 10);
          return { detected: true, year: endYear };
        }
        
        const standaloneYear = footerText.match(/\b(20\d{2})\b/);
        if (standaloneYear) {
          const year = parseInt(standaloneYear[1], 10);
          if (year >= 2010 && year <= currentYear + 1) {
            return { detected: true, year };
          }
        }
        
        return { detected: true, year: null };
      }
    }
    
    const bodyText = $('body').text();
    if (bodyText.includes('©') || bodyText.includes('copyright')) {
      const yearMatches = bodyText.match(/(?:©|copyright)\s*(?:\(c\)\s*)?(\d{4})/i);
      if (yearMatches) {
        const year = parseInt(yearMatches[1], 10);
        return { detected: true, year };
      }
    }
    
    return { detected: false, year: null };
  }

  private detectPrivacyPolicy($: cheerio.CheerioAPI): boolean {
    const privacyLinks = $('a').filter((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      return (
        text.includes('privacy') ||
        text.includes('policy') ||
        href.includes('privacy') ||
        href.includes('policy')
      );
    });
    
    return privacyLinks.length > 0;
  }

  private detectTermsPage($: cheerio.CheerioAPI): boolean {
    const termsLinks = $('a').filter((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      return (
        text.includes('terms') ||
        text.includes('conditions') ||
        text.includes('tos') ||
        href.includes('terms') ||
        href.includes('conditions')
      );
    });
    
    return termsLinks.length > 0;
  }

  private countFooterLinks($: cheerio.CheerioAPI): number {
    const footerSelectors = ['footer', '.footer', '#footer', '[role="contentinfo"]'];
    let maxLinks = 0;
    
    for (const selector of footerSelectors) {
      const links = $(selector).find('a').length;
      if (links > maxLinks) {
        maxLinks = links;
      }
    }
    
    return maxLinks;
  }

  private detectFooterContact($: cheerio.CheerioAPI): boolean {
    const footerSelectors = ['footer', '.footer', '#footer', '[role="contentinfo"]'];
    
    for (const selector of footerSelectors) {
      const footerText = $(selector).text().toLowerCase();
      const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(footerText);
      const hasPhone = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(footerText);
      
      if (hasEmail || hasPhone) {
        return true;
      }
    }
    
    return false;
  }

  private getDefaultFooterAnalysis(): FooterAnalysis {
    return {
      copyrightDetected: false,
      copyrightYear: null,
      privacyPolicy: false,
      termsPage: false,
      footerComplete: false,
      footerLinks: 0,
      hasContactInfo: false,
    };
  }
}

export const footerAnalyzer = new FooterAnalyzer();
