import { logger } from '../utils/logger';
import { BrowserPool } from '../browser/browser-pool';
import { RetryHandler } from '../recovery/retry-handler';
import { TimeoutHandler } from '../recovery/timeout-handler';
import { ScraperSession } from './scraper-session';
import { ScraperWorker } from './scraper-worker';
import { ScrapeOptions, ScrapeResult } from '../types/scraper.types';

export interface ScraperManagerOptions {
  maxConcurrentScrapes: number;
  maxRetries: number;
  timeout: number;
  headless: boolean;
}

export class ScraperManager {
  private browserPool: BrowserPool;
  private retryHandler: RetryHandler;
  private timeoutHandler: TimeoutHandler;
  private worker: ScraperWorker;
  private options: ScraperManagerOptions;

  constructor(options: Partial<ScraperManagerOptions> = {}) {
    this.options = {
      maxConcurrentScrapes: 3,
      maxRetries: 3,
      timeout: 120000,
      headless: true,
      ...options,
    };

    this.browserPool = new BrowserPool({
      maxBrowsers: this.options.maxConcurrentScrapes,
      headless: this.options.headless,
    });

    this.retryHandler = new RetryHandler(this.options.maxRetries);
    this.timeoutHandler = new TimeoutHandler(this.options.timeout);

    this.worker = new ScraperWorker(this.browserPool);
  }

  async start(): Promise<void> {
    logger.info('ScraperManager: Starting');
    await this.browserPool.initialize();
    logger.info('ScraperManager: Started');
  }

  async stop(): Promise<void> {
    logger.info('ScraperManager: Stopping');
    await this.browserPool.closeAll();
    logger.info('ScraperManager: Stopped');
  }

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    const { keyword, location, limit = 50 } = options;

    logger.info({ keyword, location, limit }, 'ScraperManager: Starting scrape');

    const session = new ScraperSession(keyword, location || '', limit);

    try {
      const result = await this.timeoutHandler.withTimeout<ScrapeResult>(
        () =>
          this.retryHandler.withRetry<ScrapeResult>(
            () => this.worker.execute(session, options)
          ),
        this.options.timeout,
        `Scrape timeout for "${keyword}" in "${location}"`
      );

      logger.info(
        { keyword, stored: result.totalStored, extracted: result.totalExtracted },
        'ScraperManager: Scrape completed'
      );

      return result;
    } catch (error: any) {
      logger.error({ err: error.message, keyword, location }, 'ScraperManager: Scrape failed');

      try {
        await this.browserPool.restart(session.id);
      } catch (restartError: any) {
        logger.warn({ err: restartError.message }, 'ScraperManager: Browser restart failed');
      }

      throw error;
    }
  }

  getStatus(): {
    activeSessions: number;
    browserCount: number;
    queueLength: number;
    uptime: number;
  } {
    return {
      activeSessions: this.browserPool.getActiveCount(),
      browserCount: this.browserPool.getBrowserCount(),
      queueLength: this.retryHandler.getQueueLength(),
      uptime: 0,
    };
  }

  getMetrics(): {
    totalScrapes: number;
    successfulScrapes: number;
    failedScrapes: number;
    averageScrapeTime: number;
  } {
    return {
      totalScrapes: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      averageScrapeTime: 0,
    };
  }

  async restart(): Promise<void> {
    logger.info('ScraperManager: Restarting browser pool');
    await this.browserPool.restartAll();
    logger.info('ScraperManager: Browser pool restarted');
  }
}

export const scraperManager = new ScraperManager();
