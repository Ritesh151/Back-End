import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { websiteAnalysisService } from './website-analysis.service';
import {
  WebsiteAnalysis,
  WebsiteStatus,
  QualificationLevel,
  LeadAnalysis,
  AnalysisResult,
} from '../types/analysis.types';
interface AnalysisOptions {
  timeout?: number;
  followRedirects?: boolean;
}

interface AnalysisOptions {
  timeout?: number;
  followRedirects?: boolean;
}

export class WebsiteAnalyzerService {
  private defaultTimeout = 15000;
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  /**
   * Analyze a single website and return detailed analysis
   */
  async analyzeWebsite(website: string, options: AnalysisOptions = {}): Promise<WebsiteAnalysis> {
    const startTime = Date.now();
    const timeout = options.timeout || this.defaultTimeout;
    const userAgent = this.getRandomUserAgent();

    const analysis: WebsiteAnalysis = {
      url: website,
      sslEnabled: false,
      responseTime: 0,
      hasContactPage: false,
      hasSocialLinks: {
        facebook: false,
        instagram: false,
        linkedin: false,
        twitter: false,
      },
      metaTitle: '',
      metaDescription: '',
      mobileFriendly: false,
      modernStructure: false,
      seoScore: 0,
      qualityScore: 0,
      issues: [],
    };

    try {
      // Normalize URL
      let normalizedUrl = this.normalizeUrl(website);
      if (!normalizedUrl) {
        throw new Error('Invalid website URL');
      }

      // Make HTTP request
      const response = await axios.get(normalizedUrl, {
        timeout,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: 5,
        validateStatus: () => true, // Don't throw on any status code
      });

      const endTime = Date.now();
      analysis.responseTime = endTime - startTime;
      analysis.sslEnabled = normalizedUrl.startsWith('https://');

      // Parse HTML content
      const $ = cheerio.load(response.data);
      analysis.metaTitle = this.extractMetaTitle($);
      analysis.metaDescription = this.extractMetaDescription($);
      analysis.hasContactPage = this.detectContactPage($, response.request.res?.responseUrl || normalizedUrl);
      analysis.hasSocialLinks = this.detectSocialLinks($, response.request.res?.responseUrl || normalizedUrl);
      analysis.mobileFriendly = this.checkMobileFriendly($);
      analysis.modernStructure = this.checkModernStructure($);

      // Calculate scores
      analysis.seoScore = this.calculateSeoScore($, analysis);
      analysis.qualityScore = this.calculateQualityScore(analysis);

      // Detect issues
      analysis.issues = this.detectIssues($, analysis);

      logger.info(`Website analysis completed for ${website} - Score: ${analysis.qualityScore}`);

    } catch (error: any) {
      logger.warn(`Website analysis failed for ${website}: ${error.message}`);
      
      // If the request failed, we still return analysis with detected issues
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        analysis.issues.push('Website timeout or unreachable');
      } else if (error.code === 'ECONNREFUSED') {
        analysis.issues.push('Connection refused');
      } else if (error.response) {
        analysis.issues.push(`HTTP ${error.response.status}`);
      } else {
        analysis.issues.push(error.message || 'Unknown error');
      }
    }

    return analysis;
  }

  /**
   * Analyze a lead's website and return complete lead analysis
   */
  async analyzeLead(leadId: string, website: string): Promise<LeadAnalysis> {
    const analysis = websiteAnalysisService.analyze(website);
    if (!analysis.analysisEligible) {
      logger.info(`Lead ${leadId}: Non-business website detected — skipping heavy analysis`);
      const wAnalysis: WebsiteAnalysis = {
        url: website,
        sslEnabled: false,
        responseTime: 0,
        metaTitle: '',
        metaDescription: '',
        hasContactPage: false,
        hasSocialLinks: { facebook: false, instagram: false, linkedin: false, twitter: false },
        mobileFriendly: false,
        modernStructure: false,
        seoScore: 0,
        qualityScore: 0,
        issues: [`Non-business website (${analysis.websiteType})`],
      };
      return {
        leadId,
        websiteStatus: 'no-website',
        leadScore: 0,
        qualificationLevel: 'low-potential',
        analyzedAt: new Date().toISOString(),
        analysisData: wAnalysis,
      };
    }

    const websiteData = await this.analyzeWebsite(website);

    const websiteStatus = this.determineWebsiteStatus(websiteData);
    const leadScore = this.calculateLeadScore(websiteData, websiteStatus);
    const qualificationLevel = this.determineQualificationLevel(leadScore);

    const leadAnalysis: LeadAnalysis = {
      leadId,
      websiteStatus,
      leadScore,
      qualificationLevel,
      analyzedAt: new Date().toISOString(),
      analysisData: websiteData,
    };

    logger.info(`Lead analysis completed for ${leadId}: Score=${leadScore}, Status=${websiteStatus}, Level=${qualificationLevel}`);

    return leadAnalysis;
  }

  /**
   * Analyze multiple leads in bulk
   */
  async analyzeBulk(leads: Array<{ id: string; website?: string }>, options: { limit?: number } = {}): Promise<AnalysisResult> {
    const limit = options.limit || 50;
    const results: LeadAnalysis[] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < Math.min(leads.length, limit); i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (lead) => {
        if (!lead.website) {
          failed++;
          return null;
        }

        try {
          const analysis = await this.analyzeLead(lead.id, lead.website);
          successful++;
          return analysis;
        } catch (error) {
          logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to analyze lead ${lead.id}:`);
          failed++;
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is LeadAnalysis => !!r));
    }

    return {
      success: true,
      message: `Analyzed ${successful} websites, ${failed} failed`,
      totalAnalyzed: successful,
      results,
    };
  }

  /**
   * Determine website status based on analysis
   */
  private determineWebsiteStatus(analysis: WebsiteAnalysis): WebsiteStatus {
    const issues = analysis.issues.length;
    const qualityScore = analysis.qualityScore;

    // No website or unreachable
    if (issues >= 3 || analysis.responseTime === 0) {
      return 'no-website';
    }

    // Broken website
    if (issues >= 2 || qualityScore < 30) {
      return 'broken-website';
    }

    // Outdated website
    if (qualityScore < 60 || !analysis.modernStructure || !analysis.hasContactPage) {
      return 'outdated-website';
    }

    // Average website
    if (qualityScore < 80 || !analysis.sslEnabled) {
      return 'average-website';
    }

    // Modern website
    return 'modern-website';
  }

  /**
   * Calculate lead score based on website analysis
   */
  private calculateLeadScore(analysis: WebsiteAnalysis, websiteStatus: WebsiteStatus): number {
    let score = 50; // Base score

    // Deduct points for website status
    switch (websiteStatus) {
      case 'no-website':
        score = 95; // High score = no website (needs improvement)
        break;
      case 'broken-website':
        score = 90; // High score = broken website
        break;
      case 'outdated-website':
        score = 75; // Medium-high score = outdated website
        break;
      case 'average-website':
        score = 60; // Medium score = average website
        break;
      case 'modern-website':
        score = 20; // Low score = modern website (good standing)
        break;
    }

    // Deduct points for SSL
    if (!analysis.sslEnabled) {
      score += 10;
    }

    // Deduct points for missing meta tags
    if (!analysis.metaTitle || analysis.metaTitle.length < 10) {
      score += 5;
    }
    if (!analysis.metaDescription || analysis.metaDescription.length < 50) {
      score += 5;
    }

    // Deduct points for slow response
    if (analysis.responseTime > 3000) {
      score += 5;
    }
    if (analysis.responseTime > 5000) {
      score += 10;
    }

    // Deduct points for missing contact page
    if (!analysis.hasContactPage) {
      score += 5;
    }

    // Deduct points for missing social links
    const socialCount = Object.values(analysis.hasSocialLinks).filter(Boolean).length;
    if (socialCount === 0) {
      score += 5;
    }

    // Deduct points for poor SEO
    if (analysis.seoScore < 50) {
      score += 10;
    }

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Determine qualification level based on lead score
   */
  private determineQualificationLevel(leadScore: number): QualificationLevel {
    if (leadScore >= 85) {
      return 'high-potential';
    }
    if (leadScore >= 60) {
      return 'medium-potential';
    }
    return 'low-potential';
  }

  /**
   * Extract meta title from HTML
   */
  private extractMetaTitle($: cheerio.CheerioAPI): string {
    const title = $('title').text().trim();
    return title || '';
  }

  /**
   * Extract meta description from HTML
   */
  private extractMetaDescription($: cheerio.CheerioAPI): string {
    const description = $('meta[name="description"]').attr('content');
    return description ? description.trim() : '';
  }

  /**
   * Detect contact page presence
   */
  private detectContactPage($: cheerio.CheerioAPI, baseUrl: string): boolean {
    // Check for contact link
    const contactLinks = $('a')
      .filter((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        return text.includes('contact') || href.includes('contact');
      })
      .length;

    if (contactLinks > 0) return true;

    // Check for common contact page paths
    const contactPaths = ['/contact', '/contact-us', '/contacto', '/contactar', '/about/contact'];
    for (const path of contactPaths) {
      const fullUrl = baseUrl.replace(/\/+$/, '') + path;
      if (fullUrl.includes(baseUrl.split('/')[2])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect social media links
   */
  private detectSocialLinks($: cheerio.CheerioAPI, _baseUrl: string): WebsiteAnalysis['hasSocialLinks'] {
    const socialLinks: WebsiteAnalysis['hasSocialLinks'] = {
      facebook: false,
      instagram: false,
      linkedin: false,
      twitter: false,
    };

    const allLinks = $('a').map((_, el) => $(el).attr('href')).toArray();

    for (const href of allLinks) {
      if (!href) continue;
      const lowerHref = href.toLowerCase();

      if (lowerHref.includes('facebook.com')) {
        socialLinks.facebook = true;
      }
      if (lowerHref.includes('instagram.com')) {
        socialLinks.instagram = true;
      }
      if (lowerHref.includes('linkedin.com')) {
        socialLinks.linkedin = true;
      }
      if (lowerHref.includes('twitter.com') || lowerHref.includes('x.com')) {
        socialLinks.twitter = true;
      }
    }

    return socialLinks;
  }

  /**
   * Check mobile responsiveness
   */
  private checkMobileFriendly($: cheerio.CheerioAPI): boolean {
    // Check for viewport meta tag
    const viewport = $('meta[name="viewport"]').length > 0;
    
    // Check for responsive CSS frameworks
    const bootstrap = $('link[href*="bootstrap"]').length > 0;
    const tailwind = $('link[href*="tailwind"]').length > 0;
    const foundation = $('link[href*="foundation"]').length > 0;

    // Check for responsive meta tags
    const mobileMeta = $('meta[name="mobile-web-app-capable"]').length > 0 ||
                       $('meta[name="apple-mobile-web-app-capable"]').length > 0 ||
                       $('meta[property="og:site_name"]').length > 0;

    return viewport || bootstrap || tailwind || foundation || mobileMeta;
  }

  /**
   * Check for modern website structure
   */
  private checkModernStructure($: cheerio.CheerioAPI): boolean {
    // Check for HTML5 doctype
    const hasHtml5 = $('html[lang]').length > 0;

    // Check for semantic HTML5 elements
    const semanticElements = ['header', 'nav', 'main', 'footer', 'section', 'article'];
    let semanticScore = 0;
    for (const element of semanticElements) {
      if ($(element).length > 0) {
        semanticScore++;
      }
    }

    // Check for structured data (JSON-LD)
    const structuredData = $('script[type="application/ld+json"]').length > 0;

    // Check for modern meta tags
    const modernMeta = $('meta[property="og:title"]').length > 0 ||
                       $('meta[property="og:description"]').length > 0 ||
                       $('meta[name="theme-color"]').length > 0;

    // Modern if at least 2 indicators
    return hasHtml5 && (semanticScore >= 2 || structuredData || modernMeta);
  }

  /**
   * Calculate SEO score
   */
  private calculateSeoScore($: cheerio.CheerioAPI, analysis: WebsiteAnalysis): number {
    let score = 0;

    // Title tag (20 points)
    const title = analysis.metaTitle;
    if (title) {
      if (title.length >= 30 && title.length <= 60) {
        score += 20;
      } else if (title.length > 0) {
        score += 10;
      }
    }

    // Meta description (20 points)
    const description = analysis.metaDescription;
    if (description) {
      if (description.length >= 120 && description.length <= 160) {
        score += 20;
      } else if (description.length > 0) {
        score += 10;
      }
    }

    // Heading structure (15 points)
    const h1Count = $('h1').length;
    if (h1Count === 1) {
      score += 15;
    } else if (h1Count > 0) {
      score += 10;
    }

    // Image alt tags (15 points)
    const allImages = $('img').length;
    const imagesWithAlt = $('img[alt]').length;
    if (allImages > 0) {
      score += (imagesWithAlt / allImages) * 15;
    }

    // Internal links (10 points)
    const internalLinks = $('a[href^="/"]').length;
    if (internalLinks > 5) {
      score += 10;
    } else if (internalLinks > 0) {
      score += 5;
    }

    // Mobile friendly (10 points)
    if (analysis.mobileFriendly) {
      score += 10;
    }

    // SSL/HTTPS (10 points)
    if (analysis.sslEnabled) {
      score += 10;
    }

    return Math.round(score);
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(analysis: WebsiteAnalysis): number {
    let score = 0;

    // SSL (20 points)
    if (analysis.sslEnabled) score += 20;

    // Meta tags (20 points)
    if (analysis.metaTitle && analysis.metaTitle.length >= 30) score += 10;
    if (analysis.metaDescription && analysis.metaDescription.length >= 120) score += 10;

    // Contact page (15 points)
    if (analysis.hasContactPage) score += 15;

    // Social links (15 points)
    const socialCount = Object.values(analysis.hasSocialLinks).filter(Boolean).length;
    score += (socialCount / 4) * 15;

    // Mobile friendly (10 points)
    if (analysis.mobileFriendly) score += 10;

    // Modern structure (10 points)
    if (analysis.modernStructure) score += 10;

    // Response time (10 points)
    if (analysis.responseTime > 0) {
      if (analysis.responseTime < 1000) score += 10;
      else if (analysis.responseTime < 2000) score += 8;
      else if (analysis.responseTime < 3000) score += 5;
    }

    return Math.round(score);
  }

  /**
   * Detect issues with the website
   */
  private detectIssues($: cheerio.CheerioAPI, analysis: WebsiteAnalysis): string[] {
    const issues: string[] = [];

    // Missing title
    if (!analysis.metaTitle || analysis.metaTitle.length < 10) {
      issues.push('Missing or very short title tag');
    }

    // Missing description
    if (!analysis.metaDescription || analysis.metaDescription.length < 50) {
      issues.push('Missing or very short meta description');
    }

    // No SSL
    if (!analysis.sslEnabled) {
      issues.push('Website does not use HTTPS');
    }

    // Missing contact page
    if (!analysis.hasContactPage) {
      issues.push('No contact page detected');
    }

    // No social links
    const socialCount = Object.values(analysis.hasSocialLinks).filter(Boolean).length;
    if (socialCount === 0) {
      issues.push('No social media links detected');
    }

    // Slow response
    if (analysis.responseTime > 5000) {
      issues.push('Slow response time (>5 seconds)');
    } else if (analysis.responseTime > 3000) {
      issues.push('Slow response time (>3 seconds)');
    }

    // No heading structure
    if ($('h1').length === 0) {
      issues.push('Missing H1 heading');
    }

    // Images without alt
    const allImages = $('img').length;
    const imagesWithoutAlt = $('img:not([alt])').length;
    if (allImages > 0 && imagesWithoutAlt > allImages / 2) {
      issues.push('Many images missing alt attributes');
    }

    // Outdated DOCTYPE
    const hasHtml5 = $('html[lang]').length > 0;
    if (!hasHtml5) {
      issues.push('Website may not use HTML5');
    }

    return issues;
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

    // Validate URL format
    try {
      new URL(normalized);
    } catch {
      return null;
    }

    return normalized;
  }

  /**
   * Get random user agent
   */
  private getRandomUserAgent(): string {
    const index = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[index];
  }
}

export const websiteAnalyzerService = new WebsiteAnalyzerService();
