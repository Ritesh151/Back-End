import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { WebsiteFreshness } from './types';

export class FreshnessDetector {
  async detectFreshness(html: string, copyrightYear: number | null): Promise<WebsiteFreshness> {
    try {
      const currentYear = new Date().getFullYear();
      const $ = cheerio.load(html);
      
      const yearsBehind = copyrightYear ? currentYear - copyrightYear : 0;
      const staleCopyright = copyrightYear !== null && yearsBehind > 1;
      
      const designGeneration = this.detectDesignGeneration($, copyrightYear);
      const modernStandards = this.checkModernStandards($);
      
      let status: WebsiteFreshness['status'];
      if (yearsBehind === 0 && modernStandards) {
        status = 'fresh';
      } else if (yearsBehind <= 1 && modernStandards) {
        status = 'moderate';
      } else if (yearsBehind <= 3 || !modernStandards) {
        status = 'outdated';
      } else {
        status = 'very-outdated';
      }

      const freshness: WebsiteFreshness = {
        status,
        copyrightYear,
        yearsBehind,
        staleCopyright,
        designGeneration,
        modernStandards,
      };

      logger.info(`Freshness: status=${status}, years=${yearsBehind}, modern=${modernStandards}`);
      return freshness;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to detect freshness:');
      return this.getDefaultFreshness();
    }
  }

  private detectDesignGeneration($: cheerio.CheerioAPI, copyrightYear: number | null): string {
    const currentYear = new Date().getFullYear();
    
    if (copyrightYear && copyrightYear >= currentYear - 1) {
      return 'modern';
    }
    
    if (copyrightYear && copyrightYear >= 2020) {
      return '2020s-style';
    }
    
    if (copyrightYear && copyrightYear >= 2015) {
      return '2015-2019-style';
    }
    
    if (copyrightYear && copyrightYear >= 2010) {
      return '2010-2014-style';
    }
    
    const hasFlexbox = $('[style*="display: flex"], [style*="display:flex"]').length > 0;
    const hasGrid = $('[style*="display: grid"], [style*="display:grid"]').length > 0;
    const hasTables = $('table[width], table[border]').length > 0;
    
    if (hasFlexbox || hasGrid) {
      return 'modern-layout';
    }
    
    if (hasTables) {
      return 'legacy-table-layout';
    }
    
    return 'unknown-generation';
  }

  private checkModernStandards($: cheerio.CheerioAPI): boolean {
    let score = 0;
    
    const hasViewportMeta = $('meta[name="viewport"]').length > 0;
    if (hasViewportMeta) score++;
    
    const hasHTML5Doctype = $('html').attr('lang') !== undefined;
    if (hasHTML5Doctype) score++;
    
    const hasSemanticElements = $('header, nav, main, section, article, aside, footer').length > 0;
    if (hasSemanticElements) score++;
    
    const hasModernCSS = this.detectModernCSS($);
    if (hasModernCSS) score++;
    
    const hasResponsiveFramework = this.detectResponsiveFramework($);
    if (hasResponsiveFramework) score++;
    
    return score >= 3;
  }

  private detectModernCSS($: cheerio.CheerioAPI): boolean {
    const inlineStyles = $('style').html() || '';
    
    const modernPatterns = [
      'flexbox',
      'grid',
      'var(--',
      '@media',
      'transform',
      'transition',
    ];
    
    for (const pattern of modernPatterns) {
      if (inlineStyles.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }

  private detectResponsiveFramework($: cheerio.CheerioAPI): boolean {
    const frameworks = [
      'bootstrap',
      'tailwind',
      'foundation',
      'bulma',
      'materialize',
    ];
    
    const classes = $('[class]').map((_, el) => $(el).attr('class') || '').get();
    const allClasses = classes.join(' ').toLowerCase();
    
    for (const framework of frameworks) {
      if (allClasses.includes(framework)) {
        return true;
      }
    }
    
    const links = $('link[rel="stylesheet"]');
    for (let i = 0; i < links.length; i++) {
      const href = $(links[i]).attr('href') || '';
      for (const framework of frameworks) {
        if (href.toLowerCase().includes(framework)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private getDefaultFreshness(): WebsiteFreshness {
    return {
      status: 'outdated',
      copyrightYear: null,
      yearsBehind: 0,
      staleCopyright: false,
      designGeneration: 'unknown',
      modernStandards: false,
    };
  }
}

export const freshnessDetector = new FreshnessDetector();
