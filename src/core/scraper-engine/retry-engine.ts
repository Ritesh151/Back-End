import { logger } from '../../utils/logger';
import { RetryConfig, DEFAULT_RETRY_CONFIG, NON_RETRYABLE_ERRORS } from './types';

export class RetryEngine {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async execute<T>(
    fn: () => Promise<T>,
    context: { source: string; keyword: string; attempt?: number }
  ): Promise<{ success: boolean; data: T | null; error: string | null; retriesUsed: number }> {
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        if (attempt > 0) {
          logger.info({
            source: context.source,
            keyword: context.keyword,
            attempt: attempt + 1,
          }, 'RetryEngine: Succeeded on retry');
        }
        return { success: true, data: result, error: null, retriesUsed: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (!this.shouldRetry(lastError)) {
          logger.info({
            source: context.source,
            keyword: context.keyword,
            error: lastError,
            attempt: attempt + 1,
          }, 'RetryEngine: Non-retryable error, stopping');
          break;
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt);
          logger.warn({
            source: context.source,
            keyword: context.keyword,
            error: lastError,
            attempt: attempt + 1,
            nextRetryInMs: delay,
          }, 'RetryEngine: Will retry');

          await this.sleep(delay);
        }
      }
    }

    return { success: false, data: null, error: lastError, retriesUsed: this.config.maxRetries };
  }

  shouldRetry(error: string): boolean {
    const lower = error.toLowerCase();
    const isNonRetryable = NON_RETRYABLE_ERRORS.some(nr => lower.includes(nr));
    return !isNonRetryable;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffFactor, attempt);
    return Math.min(delay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const DEFAULT_RETRY_CONFIG_OBJ: RetryConfig = { ...DEFAULT_RETRY_CONFIG };
