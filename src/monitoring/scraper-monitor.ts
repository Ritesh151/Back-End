import { logger } from '../utils/logger';
import { ScraperSession } from '../scraper-core/scraper-session';

export interface ScraperMetrics {
  activeSessions: number;
  totalScrapes: number;
  successfulScrapes: number;
  failedScrapes: number;
  averageScrapeTime: number;
  browserCrashes: number;
  retryCount: number;
  lastScrapeTime?: Date;
}

export class ScraperMonitor {
  private sessionCount: number = 0;
  private scrapeCount: number = 0;
  private successCount: number = 0;
  private failureCount: number = 0;
  private crashCount: number = 0;
  private totalRetryCount: number = 0;
  private scrapeTimes: number[] = [];
  private lastScrapeTime?: Date;

  constructor() {}

  /**
   * Track session start
   */
  trackSessionStart(): void {
    this.sessionCount++;
    logger.info('ScraperMonitor: Session started');
  }

  /**
   * Track session completion
   */
  trackSessionComplete(session: ScraperSession, success: boolean): void {
    const duration = session.getDuration();
    this.scrapeCount++;
    this.lastScrapeTime = new Date();

    if (success) {
      this.successCount++;
      this.scrapeTimes.push(duration);
      // Keep only last 100 scrape times
      if (this.scrapeTimes.length > 100) {
        this.scrapeTimes.shift();
      }
    } else {
      this.failureCount++;
    }

    this.sessionCount--;
    this.totalRetryCount += session.retryCount;

    logger.info(`ScraperMonitor: Session completed - success: ${success}, time: ${duration}s`);
  }

  /**
   * Track browser crash
   */
  trackBrowserCrash(): void {
    this.crashCount++;
    logger.error('ScraperMonitor: Browser crash detected');
  }

  /**
   * Track retry
   */
  trackRetry(): void {
    this.totalRetryCount++;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ScraperMetrics {
    const avgScrapeTime = this.scrapeTimes.length > 0
      ? this.scrapeTimes.reduce((a, b) => a + b, 0) / this.scrapeTimes.length
      : 0;

    return {
      activeSessions: this.sessionCount,
      totalScrapes: this.scrapeCount,
      successfulScrapes: this.successCount,
      failedScrapes: this.failureCount,
      averageScrapeTime: Math.round(avgScrapeTime * 100) / 100,
      browserCrashes: this.crashCount,
      retryCount: this.totalRetryCount,
      lastScrapeTime: this.lastScrapeTime,
    };
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.scrapeCount === 0) return 0;
    return (this.successCount / this.scrapeCount) * 100;
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    if (this.scrapeCount === 0) return 0;
    return (this.failureCount / this.scrapeCount) * 100;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.sessionCount = 0;
    this.scrapeCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.crashCount = 0;
    this.totalRetryCount = 0;
    this.scrapeTimes = [];
    this.lastScrapeTime = undefined;
    logger.info('ScraperMonitor: Metrics reset');
  }
}

export const scraperMonitor = new ScraperMonitor();
