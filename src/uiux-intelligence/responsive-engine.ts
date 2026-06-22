import { logger } from '../utils/logger';
import { browserPool } from '../services/browser-pool.service';
import {
  FullResponsiveAuditResult,
  ResponsiveAnalysisOptions,
  VIEWPORTS,
  ResponsiveAudit,
  LayoutMetrics,
  UIUXAuditResult,
} from './types';
import { screenshotEngine } from './screenshot-engine';
import { layoutBreakDetector } from './layout-break-detector';
import { viewportChecker } from './viewport-checker';
import { uiuxAnalyzer } from './uiux-analyzer';
import { responsiveScoreEngine } from './responsive-score-engine';
import pLimit from 'p-limit';

export class ResponsiveEngine {
  private readonly maxConcurrent = 2;
  private readonly limit = pLimit(this.maxConcurrent);

  async initialize(): Promise<void> {
    // Browser pool is shared - no separate initialization needed
  }

  async cleanup(): Promise<void> {
    // Browser pool handles cleanup
  }

  async analyzeWebsite(
    url: string,
    options: ResponsiveAnalysisOptions = {}
  ): Promise<FullResponsiveAuditResult> {
    return this.limit(async () => {
      const timeout = Math.min(options.timeout || 60000, 90000);
      const skipScreenshots = options.skipScreenshots || false;
      const screenshotQuality = options.screenshotQuality || 80;
      const startTime = Date.now();

      try {
        logger.info(`[ResponsiveEngine] Starting responsive audit for ${url}`);

        const normalizedUrl = this.normalizeUrl(url);
        if (!normalizedUrl) {
          throw new Error(`Invalid URL format: ${url}`);
        }

        this.preventSSRF(normalizedUrl);

        let desktopResults;
        try {
          logger.info(`[ResponsiveEngine] Analyzing desktop viewport for ${normalizedUrl}`);
          desktopResults = await this.analyzeViewport(
            normalizedUrl,
            VIEWPORTS.DESKTOP,
            timeout,
            skipScreenshots,
            screenshotQuality
          );
        } catch (error) {
          logger.error(error instanceof Error ? error : new Error(String(error)), `[ResponsiveEngine] Desktop viewport analysis failed for ${normalizedUrl}`);
          throw new Error(`Desktop viewport analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        let mobileResults;
        try {
          logger.info(`[ResponsiveEngine] Analyzing mobile viewport for ${normalizedUrl}`);
          mobileResults = await this.analyzeViewport(
            normalizedUrl,
            VIEWPORTS.MOBILE,
            timeout,
            skipScreenshots,
            screenshotQuality
          );
        } catch (error) {
          logger.error(error instanceof Error ? error : new Error(String(error)), `[ResponsiveEngine] Mobile viewport analysis failed for ${normalizedUrl}`);
          throw new Error(`Mobile viewport analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        const responsiveAudit: ResponsiveAudit = {
          mobileFriendly: this.determineMobileFriendly(mobileResults),
          responsiveLayout: this.determineResponsiveLayout(desktopResults.metrics, mobileResults.metrics),
          horizontalScroll: mobileResults.metrics.hasHorizontalScroll,
          overflowIssues: mobileResults.metrics.bodyOverflowX,
          viewportMeta: mobileResults.viewport.viewportMeta || false,
          viewportContent: mobileResults.viewport.viewportContent || null,
          touchFriendly: mobileResults.viewport.touchFriendly || false,
          fontSizeIssues: mobileResults.viewport.fontSizeIssues || false,
        };

        const uiuxAudit = this.mergeUIUXAudits(desktopResults.uiux, mobileResults.uiux);

        const scores = responsiveScoreEngine.calculateScores(
          responsiveAudit,
          uiuxAudit,
          desktopResults.metrics,
          mobileResults.metrics
        );

        const result: FullResponsiveAuditResult = {
          responsiveAudit,
          uiuxAudit,
          screenshots: {
            desktopScreenshot: desktopResults.screenshot,
            mobileScreenshot: mobileResults.screenshot,
          },
          scores,
          desktopMetrics: desktopResults.metrics,
          mobileMetrics: mobileResults.metrics,
          responsiveAuditCompleted: true,
          auditedAt: new Date(),
        };

        const duration = Date.now() - startTime;
        logger.info(`[ResponsiveEngine] Responsive audit COMPLETED for ${normalizedUrl} in ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(error instanceof Error ? error : new Error(String(error)), `[ResponsiveEngine] Responsive audit FAILED for ${url} after ${duration}ms`);

        return {
          responsiveAudit: {
            mobileFriendly: false,
            responsiveLayout: false,
            horizontalScroll: false,
            overflowIssues: false,
            viewportMeta: false,
            viewportContent: null,
            touchFriendly: false,
            fontSizeIssues: false,
          },
          uiuxAudit: {
            alignmentIssues: false,
            brokenButtons: false,
            croppedSections: false,
            mobileLayoutBroken: false,
            overlappingContent: false,
            hiddenContent: false,
            navigationIssues: false,
            spacingIssues: false,
            issues: [],
          },
          screenshots: {
            desktopScreenshot: null,
            mobileScreenshot: null,
          },
          scores: {
            responsiveScore: 0,
            uiuxScore: 0,
            mobileExperienceScore: 0,
          },
          desktopMetrics: this.getEmptyMetrics(),
          mobileMetrics: this.getEmptyMetrics(),
          responsiveAuditCompleted: false,
          auditedAt: new Date(),
        };
      }
    });
  }

  private async analyzeViewport(
    url: string,
    viewport: typeof VIEWPORTS.DESKTOP | typeof VIEWPORTS.MOBILE,
    timeout: number,
    skipScreenshots: boolean,
    screenshotQuality: number
  ): Promise<{
    screenshot: string | null;
    metrics: LayoutMetrics;
    viewport: Partial<ResponsiveAudit>;
    uiux: UIUXAuditResult;
  }> {
    const viewportName = viewport.isMobile ? 'mobile' : 'desktop';
    const { page, context } = await browserPool.acquire(`responsive-${viewportName}`);

    try {
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      const ua = this.getUserAgent(viewport.isMobile);
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      await page.setExtraHTTPHeaders({ 'User-Agent': ua });

      logger.info(`[ResponsiveEngine] Loading ${viewportName} page for ${url} with timeout ${timeout}ms`);

      try {
        await page.goto(url, {
          waitUntil: 'load',
          timeout,
        });
        logger.info(`[ResponsiveEngine] Page loaded successfully for ${viewportName}`);
      } catch (navError) {
        logger.warn(`[ResponsiveEngine] Page navigation ${viewportName} partially loaded or timed out`);
      }

      logger.info(`[ResponsiveEngine] Waiting for page stabilization`);
      await page.waitForTimeout(1000);

      logger.info(`[ResponsiveEngine] Capturing ${viewportName} screenshot`);
      const screenshot = skipScreenshots
        ? null
        : await screenshotEngine.captureBase64Screenshot(page, viewport, screenshotQuality);

      logger.info(`[ResponsiveEngine] Analyzing ${viewportName} layout`);
      const metrics = await layoutBreakDetector.analyzeLayout(page);

      logger.info(`[ResponsiveEngine] Checking ${viewportName} viewport configuration`);
      const viewportData = await viewportChecker.checkViewport(page);

      logger.info(`[ResponsiveEngine] Analyzing ${viewportName} UI/UX`);
      const uiuxData = await uiuxAnalyzer.analyzeUIUX(page, viewport.isMobile);

      return {
        screenshot,
        metrics,
        viewport: viewportData,
        uiux: uiuxData,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `[ResponsiveEngine] Error analyzing ${viewportName} viewport:`);

      return {
        screenshot: null,
        metrics: this.getEmptyMetrics(),
        viewport: {
          viewportMeta: false,
          viewportContent: null,
          touchFriendly: false,
          fontSizeIssues: true,
        },
        uiux: {
          alignmentIssues: false,
          brokenButtons: false,
          croppedSections: false,
          mobileLayoutBroken: false,
          overlappingContent: false,
          hiddenContent: false,
          navigationIssues: false,
          spacingIssues: false,
          issues: [],
        },
      };
    } finally {
      logger.info(`[ResponsiveEngine] Closing ${viewportName} page`);
      await browserPool.release(page, `responsive-${viewportName}`);
    }
  }

  private determineMobileFriendly(mobileResults: {
    screenshot: string | null;
    metrics: LayoutMetrics;
    viewport: Partial<ResponsiveAudit>;
    uiux: UIUXAuditResult;
  }): boolean {
    if (!mobileResults.viewport.viewportMeta) return false;
    if (mobileResults.metrics.hasHorizontalScroll) return false;
    if (mobileResults.metrics.elementsOffscreen > 10) return false;
    if (mobileResults.uiux.mobileLayoutBroken) return false;
    if (mobileResults.viewport.fontSizeIssues && mobileResults.viewport.touchFriendly === false) return false;
    return true;
  }

  private determineResponsiveLayout(_desktop: LayoutMetrics, mobile: LayoutMetrics): boolean {
    if (mobile.hasHorizontalScroll) return false;
    if (mobile.elementsOffscreen > 5) return false;
    if (mobile.fixedWidthElements > 3) return false;
    if (mobile.overlappingElements > 5) return false;
    return true;
  }

  private mergeUIUXAudits(desktop: UIUXAuditResult, mobile: UIUXAuditResult): UIUXAuditResult {
    return {
      alignmentIssues: desktop.alignmentIssues || mobile.alignmentIssues,
      brokenButtons: desktop.brokenButtons || mobile.brokenButtons,
      croppedSections: desktop.croppedSections || mobile.croppedSections,
      mobileLayoutBroken: mobile.mobileLayoutBroken,
      overlappingContent: desktop.overlappingContent || mobile.overlappingContent,
      hiddenContent: desktop.hiddenContent || mobile.hiddenContent,
      navigationIssues: desktop.navigationIssues || mobile.navigationIssues,
      spacingIssues: desktop.spacingIssues || mobile.spacingIssues,
      issues: [...desktop.issues, ...mobile.issues],
    };
  }

  private getEmptyMetrics(): LayoutMetrics {
    return {
      hasHorizontalScroll: false,
      bodyOverflowX: false,
      elementsOffscreen: 0,
      fixedWidthElements: 0,
      overlappingElements: 0,
    };
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
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254',
    ];
    if (blockedHosts.includes(hostname)) {
      throw new Error('Access to local/internal hosts is not allowed');
    }
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      throw new Error('Access to private networks is not allowed');
    }
  }

  private getUserAgent(isMobile: boolean): string {
    if (isMobile) {
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    }
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }
}

export const responsiveEngine = new ResponsiveEngine();
