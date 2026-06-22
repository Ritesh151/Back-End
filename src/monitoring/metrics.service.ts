import { logger } from '../utils/logger';
import { scraperMonitor } from './scraper-monitor';

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

export class MetricsService {
  constructor() {}

  /**
   * Get scraper status
   */
  async getStatus(): Promise<ScraperMetrics> {
    return scraperMonitor.getMetrics();
  }

  /**
   * Get scraper metrics
   */
  async getMetrics(): Promise<ScraperMetrics> {
    return scraperMonitor.getMetrics();
  }

  /**
   * Get success rate
   */
  async getSuccessRate(): Promise<number> {
    return scraperMonitor.getSuccessRate();
  }

  /**
   * Get failure rate
   */
  async getFailureRate(): Promise<number> {
    return scraperMonitor.getFailureRate();
  }

  /**
   * Get detailed metrics with breakdown
   */
  async getDetailedMetrics(): Promise<{
    summary: ScraperMetrics;
    successRate: number;
    failureRate: number;
    scrapeTimeDistribution: {
      fast: number;
      medium: number;
      slow: number;
    };
  }> {
    const metrics = scraperMonitor.getMetrics();
    const successRate = scraperMonitor.getSuccessRate();
    const failureRate = scraperMonitor.getFailureRate();

    // Calculate scrape time distribution
    const avgTime = metrics.averageScrapeTime;
    let fast = 0;
    let medium = 0;
    let slow = 0;

    if (avgTime < 10) fast = 1;
    else if (avgTime < 30) medium = 1;
    else slow = 1;

    return {
      summary: metrics,
      successRate,
      failureRate,
      scrapeTimeDistribution: { fast, medium, slow },
    };
  }

  /**
   * Reset metrics
   */
  async reset(): Promise<void> {
    scraperMonitor.reset();
    logger.info('MetricsService: Metrics reset');
  }

  /**
   * Start metrics collection
   */
  async start(): Promise<void> {
    logger.info('MetricsService: Starting metrics collection');
  }

  /**
   * Stop metrics collection
   */
  async stop(): Promise<void> {
    logger.info('MetricsService: Stopping metrics collection');
  }
}

export const metricsService = new MetricsService();
