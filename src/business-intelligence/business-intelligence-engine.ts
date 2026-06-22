import { chromium, Browser, Page } from 'playwright';
import { logger } from '../utils/logger';
import { BusinessIntelligenceReport, IntelligenceAnalysisOptions, OpportunityFactors } from './types';
import { footerAnalyzer } from './footer-analyzer';
import { socialDetector } from './social-detector';
import { contactDetector } from './contact-detector';
import { freshnessDetector } from './freshness-detector';
import { trustScoreEngine } from './trust-score-engine';
import { opportunityEngine } from './opportunity-engine';
import { websiteQualityEngine } from './website-quality-engine';
import { aiRecommendationEngine } from './ai-recommendation-engine';
import pLimit from 'p-limit';

export class BusinessIntelligenceEngine {
  private browser: Browser | null = null;
  private readonly maxConcurrent = 3;
  private readonly limit = pLimit(this.maxConcurrent);

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      logger.info('Business intelligence engine browser initialized');
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Business intelligence engine browser closed');
    }
  }

  async analyzeWebsite(
    url: string,
    existingData: {
      sslEnabled?: boolean;
      seoScore?: number;
      responsiveScore?: number;
      uiuxScore?: number;
      responseTime?: number;
    },
    options: IntelligenceAnalysisOptions = {}
  ): Promise<BusinessIntelligenceReport> {
    return this.limit(async () => {
      const timeout = options.timeout || 60000;

      try {
        await this.initialize();

        if (!this.browser) {
          throw new Error('Browser not initialized');
        }

        const normalizedUrl = this.normalizeUrl(url);
        if (!normalizedUrl) {
          throw new Error('Invalid URL');
        }

        this.preventSSRF(normalizedUrl);

        logger.info(`Starting business intelligence analysis for ${normalizedUrl}`);

        const page: Page = await this.browser.newPage({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        try {
          let navigationSucceeded = true;
          try {
            await page.goto(normalizedUrl, {
              waitUntil: 'domcontentloaded',
              timeout,
            });

            await page.waitForTimeout(1000);
          } catch (navError) {
            navigationSucceeded = false;
            logger.warn({ err: navError, url: normalizedUrl }, 'Navigation failed, proceeding with degraded analysis');
          }

          let html = '';
          if (navigationSucceeded) {
            html = await page.content();
          }

          const footerAnalysis = await footerAnalyzer.analyzeFooter(html);
          const socialAudit = await socialDetector.detectSocialPresence(html);
          const contactAudit = await contactDetector.detectContactInfo(html);
          const websiteFreshness = await freshnessDetector.detectFreshness(html, footerAnalysis.copyrightYear);

          const sslEnabled = existingData.sslEnabled || false;
          const seoScore = existingData.seoScore || 0;
          const responsiveScore = existingData.responsiveScore || 0;
          const uiuxScore = existingData.uiuxScore || 0;
          const performanceScore = this.calculatePerformanceScore(existingData.responseTime || 0);

          const trustScore = trustScoreEngine.calculateTrustScore(
            sslEnabled,
            footerAnalysis,
            socialAudit,
            contactAudit,
            websiteFreshness,
            seoScore,
            responsiveScore
          );

          const websiteQualityScore = websiteQualityEngine.calculateQualityScore(
            seoScore,
            responsiveScore,
            uiuxScore,
            trustScore.score,
            performanceScore,
            socialAudit.socialPresenceScore
          );

          const opportunityFactors: OpportunityFactors = {
            poorSEO: seoScore < 50,
            outdatedUI: uiuxScore < 60,
            missingResponsiveness: responsiveScore < 70,
            weakSocialPresence: socialAudit.socialPresenceScore < 40,
            noSSL: !sslEnabled,
            noContactForm: !contactAudit.contactForm,
            outdatedCopyright: websiteFreshness.staleCopyright,
            poorTrustScore: trustScore.score < 50,
            lowQualityScore: websiteQualityScore.overall < 60,
          };

          const businessOpportunity = opportunityEngine.detectOpportunity(
            opportunityFactors,
            trustScore,
            websiteFreshness,
            websiteQualityScore.overall
          );

          const aiRecommendation = navigationSucceeded
            ? aiRecommendationEngine.generateRecommendation(
                businessOpportunity,
                opportunityFactors,
                websiteQualityScore
              )
            : {
                summary: 'Analysis incomplete — page could not be loaded',
                services: [],
                priority: 'low' as const,
                estimatedImpact: 'Unable to assess',
                keyIssues: ['Page navigation failed, no content available'],
              };

          const report: BusinessIntelligenceReport = {
            footerAnalysis,
            socialAudit,
            contactAudit,
            websiteFreshness,
            trustScore,
            businessOpportunity,
            websiteQualityScore,
            aiRecommendation,
            analyzedAt: new Date(),
            intelligenceCompleted: navigationSucceeded,
          };

          logger.info(
            navigationSucceeded
              ? `Business intelligence completed: opportunity=${businessOpportunity.level}, trust=${trustScore.score}`
              : `Business intelligence degraded for ${normalizedUrl} — page navigation failed`
          );
          return report;
        } finally {
          await page.close();
        }
      } catch (error) {
        logger.error(error instanceof Error ? error : new Error(String(error)), `Business intelligence analysis failed for ${url}:`);
        return this.getDefaultReport();
      }
    });
  }

  private calculatePerformanceScore(responseTime: number): number {
    if (responseTime === 0) return 0;
    if (responseTime < 1000) return 100;
    if (responseTime < 2000) return 90;
    if (responseTime < 3000) return 75;
    if (responseTime < 5000) return 60;
    if (responseTime < 10000) return 40;
    return 20;
  }

  private normalizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    let normalized = url.trim();

    if (!normalized.match(/^https?:\/\//i)) {
      normalized = 'https://' + normalized;
    }

    try {
      new URL(normalized);
    } catch {
      return null;
    }

    return normalized;
  }

  private preventSSRF(url: string): void {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];

    if (blockedHosts.includes(hostname)) {
      throw new Error('Access to local/internal hosts is not allowed');
    }

    if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      throw new Error('Access to private networks is not allowed');
    }
  }

  private getDefaultReport(): BusinessIntelligenceReport {
    return {
      footerAnalysis: {
        copyrightDetected: false,
        copyrightYear: null,
        privacyPolicy: false,
        termsPage: false,
        footerComplete: false,
        footerLinks: 0,
        hasContactInfo: false,
      },
      socialAudit: {
        instagram: false,
        facebook: false,
        linkedin: false,
        twitter: false,
        youtube: false,
        whatsapp: false,
        socialPresenceScore: 0,
        detectedLinks: [],
      },
      contactAudit: {
        phoneDetected: false,
        emailDetected: false,
        contactForm: false,
        googleMapsEmbed: false,
        officeAddress: false,
        whatsappButton: false,
        contactMethods: 0,
      },
      websiteFreshness: {
        status: 'outdated',
        copyrightYear: null,
        yearsBehind: 0,
        staleCopyright: false,
        designGeneration: 'unknown',
        modernStandards: false,
      },
      trustScore: {
        score: 0,
        level: 'low',
        factors: {
          ssl: false,
          contactPresence: false,
          socialPresence: false,
          seoQuality: false,
          responsiveness: false,
          copyrightFresh: false,
          businessTransparency: false,
        },
      },
      businessOpportunity: {
        level: 'low',
        score: 0,
        reasons: [],
        recommendation: 'Analysis failed',
        estimatedValue: 'low',
      },
      websiteQualityScore: {
        overall: 0,
        breakdown: {
          seo: 0,
          responsiveness: 0,
          uiux: 0,
          trust: 0,
          performance: 0,
          socialPresence: 0,
        },
      },
      aiRecommendation: {
        summary: 'Analysis incomplete',
        services: [],
        priority: 'low',
        estimatedImpact: 'Unable to assess',
        keyIssues: [],
      },
      analyzedAt: new Date(),
      intelligenceCompleted: false,
    };
  }
}

export const businessIntelligenceEngine = new BusinessIntelligenceEngine();
