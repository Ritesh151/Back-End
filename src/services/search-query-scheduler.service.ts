import { logger } from '../utils/logger';

export interface SchedulerQuery<T = unknown> {
  id: string;
  execute: () => Promise<T>;
  timeoutMs: number;
  maxRetries: number;
  retryCount: number;
  label: string;
}

export interface SchedulerResult<T = unknown> {
  id: string;
  label: string;
  success: boolean;
  data: T | null;
  error: string | null;
  durationMs: number;
  retriesUsed: number;
  timedOut: boolean;
}

export class SearchQueryScheduler {
  private concurrencyLimit: number;
  private activeCount = 0;
  private queue: Array<{
    query: SchedulerQuery;
    resolve: (result: SchedulerResult) => void;
  }> = [];
  constructor(concurrencyLimit = 5) {
    this.concurrencyLimit = concurrencyLimit;
  }

  setConcurrency(limit: number): void {
    this.concurrencyLimit = Math.max(1, limit);
    logger.info({ concurrencyLimit: this.concurrencyLimit }, 'SearchQueryScheduler: Concurrency updated');
  }

  async submit<T>(query: SchedulerQuery<T>): Promise<SchedulerResult<T>> {
    return new Promise<SchedulerResult<T>>((resolve) => {
      this.queue.push({ query: query as unknown as SchedulerQuery, resolve: resolve as unknown as (r: SchedulerResult) => void });
      this.processNext();
    });
  }

  async submitBatch<T>(queries: SchedulerQuery<T>[]): Promise<SchedulerResult<T>[]> {
    const results = await Promise.all(queries.map(q => this.submit(q)));
    return results;
  }

  private processNext(): void {
    if (this.queue.length === 0) return;

    while (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeCount++;
      this.executeWithRetry(item.query, item.resolve);
    }
  }

  private async executeWithRetry(query: SchedulerQuery, resolve: (result: SchedulerResult) => void): Promise<void> {
    const startTime = Date.now();
    let retriesUsed = 0;
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= Math.min(query.maxRetries, 2); attempt++) {
      if (attempt > 0) {
        retriesUsed = attempt;
        logger.info({
          label: query.label,
          attempt: attempt + 1,
          maxRetries: query.maxRetries,
        }, 'SearchQueryScheduler: Retrying query');
      }

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, query.timeoutMs || 20000);

      try {
        const result = await Promise.race([
          query.execute(),
          new Promise<never>((_, reject) => {
            abortController.signal.addEventListener('abort', () => {
              reject(new Error(`Query timed out after ${query.timeoutMs}ms`));
            });
          }),
        ]);

        clearTimeout(timeoutId);
        this.activeCount--;
        this.processNext();

        resolve({
          id: query.id,
          label: query.label,
          success: true,
          data: result,
          error: null,
          durationMs: Date.now() - startTime,
          retriesUsed,
          timedOut: false,
        });
        return;
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : String(error);
        const isTimeout = message.includes('timed out');
        const isRetryable = this.isRetryableError(message) && !isTimeout;

        lastError = message;

        if (isTimeout) {
          logger.warn({
            label: query.label,
            durationMs: Date.now() - startTime,
          }, 'SearchQueryScheduler: Query timed out, skipping');
          break;
        }

        if (!isRetryable || attempt >= Math.min(query.maxRetries, 2)) {
          break;
        }

        await this.delay(1000 * (attempt + 1));
      }
    }

    this.activeCount--;
    this.processNext();

    const isTimeout = lastError?.includes('timed out') ?? false;

    resolve({
      id: query.id,
      label: query.label,
      success: false,
      data: null,
      error: lastError,
      durationMs: Date.now() - startTime,
      retriesUsed,
      timedOut: isTimeout,
    });
  }

  private isRetryableError(message: string): boolean {
    const nonRetryable = [
      'invalid query',
      'invalid keyword',
      'bad request',
      'invalid source',
      'not found',
      '404',
      'validation failed',
    ];
    const lower = message.toLowerCase();
    return !nonRetryable.some(nr => lower.includes(nr));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getStatus(): { activeCount: number; queueLength: number; concurrencyLimit: number } {
    return {
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      concurrencyLimit: this.concurrencyLimit,
    };
  }

  clear(): void {
    const remaining = this.queue.splice(0);
    for (const item of remaining) {
      item.resolve({
        id: item.query.id,
        label: item.query.label,
        success: false,
        data: null,
        error: 'Scheduler cleared',
        durationMs: 0,
        retriesUsed: 0,
        timedOut: false,
      });
    }
    logger.info({ clearedJobs: remaining.length }, 'SearchQueryScheduler: Queue cleared');
  }
}

export const searchQueryScheduler = new SearchQueryScheduler(5);
