import { logger } from '../../utils/logger';
import { GoogleMapsScraper } from './sources/googleMaps/scraper';
import { JustDialScraper } from './sources/justdial/scraper';
import { IndiaMartScraper } from './sources/indiamart/scraper';
import { ScraperLead, ScraperResult, ScraperOptions, ScraperError } from './types';
import { RetryEngine } from './retry-engine';
import { browserManager } from './browser-manager';
import { MAX_CONCURRENCY } from './types';
import { searchStatus } from '../../services/search-status.service';

interface ScrapeTask {
  source: string;
  execute: () => Promise<ScraperResult>;
}

export class ScraperEngine {
  private googleMapsScraper: GoogleMapsScraper;
  private justDialScraper: JustDialScraper;
  private indiaMartScraper: IndiaMartScraper;
  private retryEngine: RetryEngine;
  private allLeads: ScraperLead[] = [];
  private allErrors: ScraperError[] = [];

  constructor() {
    this.googleMapsScraper = new GoogleMapsScraper();
    this.justDialScraper = new JustDialScraper();
    this.indiaMartScraper = new IndiaMartScraper();
    this.retryEngine = new RetryEngine({ maxRetries: 2, baseDelayMs: 2000 });
  }

  async scrapeMultiSource(options: ScraperOptions): Promise<ScraperResult> {
    this.allLeads = [];
    this.allErrors = [];

    const sessionId = options.sessionId || searchStatus.generateSessionId();

    if (sessionId) {
      searchStatus.createSession(sessionId, {
        keyword: options.keyword,
        location: options.location || '',
        state: options.state,
        city: options.city,
        area: options.area,
        sources: options.sources || ['google-maps'],
        createdBy: options.userId,
      });
    }

    const sources = options.sources.filter(s => ['google-maps', 'justdial', 'indiamart'].includes(s));
    if (sources.length === 0) {
      return {
        success: false, message: 'No valid sources provided', totalExtracted: 0,
        totalStored: 0, totalDuplicates: 0, leads: [], sourceResults: [],
      };
    }

    logger.info({
      keyword: options.keyword, sources, state: options.state,
      city: options.city, area: options.area,
    }, 'ScraperEngine: Starting multi-source scrape');

    const tasks: ScrapeTask[] = sources.map(source => ({
      source,
      execute: () => this.executeSourceScrape(source, options),
    }));

    const results = await this.executeWithConcurrencyLimit(tasks, sessionId);
    const sourceResults = results.map(r => r.sourceResults[0]);

    const totalExtracted = results.reduce((sum, r) => sum + r.totalExtracted, 0);
    const totalStored = results.reduce((sum, r) => sum + r.totalStored, 0);
    const totalDuplicates = results.reduce((sum, r) => sum + r.totalDuplicates, 0);
    const anySuccess = results.some(r => r.success);
    const anyPartial = anySuccess && this.allErrors.length > 0;

    if (sessionId) {
      for (const r of sourceResults) {
        searchStatus.updateSourceBreakdown(sessionId, r.source, r.totalStored);
      }
    }

    logger.info({
      totalExtracted, totalStored, totalDuplicates,
      errors: this.allErrors.length,
      sources: sources.join(', '),
    }, 'ScraperEngine: Multi-source scrape completed');

    if (sessionId) {
      const completedSources = results.filter(r => r.success).map(r => r.sourceResults[0]?.source).filter(Boolean);
      const failedSources = this.allErrors.map(e => e.source);
      if (anySuccess || totalStored > 0) {
        await searchStatus.markCompleted(sessionId, anyPartial, completedSources, failedSources);
      } else {
        await searchStatus.markFailed(sessionId, 'No leads found from any source', failedSources);
      }
    }

    return {
      success: anySuccess || totalStored > 0,
      message: this.buildResultMessage(anySuccess, anyPartial, totalStored, sources),
      totalExtracted,
      totalStored,
      totalDuplicates,
      leads: this.allLeads,
      sourceResults,
      partialSuccess: anyPartial || undefined,
      errors: this.allErrors.length > 0 ? this.allErrors : undefined,
    };
  }

  private async executeSourceScrape(source: string, options: ScraperOptions): Promise<ScraperResult> {
    if (options.sessionId) {
      const session = searchStatus.getProgress(options.sessionId);
      if (session) {
        session.currentSource = source;
      }
    }

    const retryResult = await this.retryEngine.execute(
      async () => {
        switch (source) {
          case 'google-maps':
            return this.googleMapsScraper.scrape({ ...options, semanticKeyword: options.semanticKeyword });
          case 'justdial':
            return this.justDialScraper.scrape({ ...options, semanticKeyword: options.semanticKeyword });
          case 'indiamart':
            return this.indiaMartScraper.scrape({ ...options, semanticKeyword: options.semanticKeyword });
          default:
            throw new Error(`Unknown source: ${source}`);
        }
      },
      { source, keyword: options.keyword }
    );

    if (retryResult.success && retryResult.data) {
      const result = retryResult.data;
      if (result.leads && result.leads.length > 0) {
        this.allLeads = [...this.allLeads, ...result.leads];
      }
      return result;
    }

    const errorMsg = retryResult.error || 'Unknown error';
    this.allErrors.push({
      source,
      keyword: options.keyword,
      error: errorMsg,
      retryable: false,
    });

    return {
      success: false,
      message: `${source} failed: ${errorMsg}`,
      totalExtracted: 0,
      totalStored: 0,
      totalDuplicates: 0,
      leads: [],
      sourceResults: [{
        source,
        totalStored: 0,
        totalExtracted: 0,
        totalDuplicates: 0,
        success: false,
        error: errorMsg,
        retriesUsed: retryResult.retriesUsed,
      }],
    };
  }

  private async executeWithConcurrencyLimit(tasks: ScrapeTask[], sessionId?: string): Promise<ScraperResult[]> {
    const results: ScraperResult[] = [];
    const running: Array<Promise<void>> = [];

    for (const task of tasks) {
      const maxConcurrent = MAX_CONCURRENCY[task.source as keyof typeof MAX_CONCURRENCY] || 2;
      const promise = this.executeTask(task, results, sessionId);
      running.push(promise);

      if (running.length >= maxConcurrent) {
        await Promise.race(running);
        const stillRunning = running.filter(p => {
          try {
            return Promise.resolve(p).then(() => false).catch(() => false);
          } catch {
            return true;
          }
        });
        running.splice(0, running.length, ...stillRunning);
      }
    }

    await Promise.allSettled(running);
    return results;
  }

  private async executeTask(task: ScrapeTask, results: ScraperResult[], sessionId?: string): Promise<void> {
    try {
      const result = await task.execute();
      results.push(result);
      if (sessionId && result.success) {
        searchStatus.updateCurrentSource(sessionId, task.source);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      results.push({
        success: false,
        message: `${task.source} failed: ${errMsg}`,
        totalExtracted: 0, totalStored: 0, totalDuplicates: 0,
        leads: [],
        sourceResults: [{
          source: task.source, totalStored: 0, totalExtracted: 0,
          totalDuplicates: 0, success: false, error: errMsg, retriesUsed: 0,
        }],
      });
    }
  }

  private buildResultMessage(
    anySuccess: boolean, anyPartial: boolean, totalStored: number, sources: string[]
  ): string {
    if (!anySuccess) return 'No leads found from any source';
    if (anyPartial) return `Partial results: ${totalStored} leads saved from ${sources.length} sources`;
    return `Scraping completed: ${totalStored} leads saved from ${sources.join(', ')}`;
  }

  getBrowserStatus() {
    return browserManager.getStatus();
  }
}

export const scraperEngine = new ScraperEngine();
