import { logger } from '../utils/logger';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponential: boolean;
}

export class RetryHandler {
  private config: RetryConfig;
  private retryCount: number = 0;

  constructor(maxRetries: number = 3) {
    this.config = {
      maxRetries,
      baseDelay: 1000,
      maxDelay: 10000,
      exponential: true,
    };
  }

  /**
   * Execute function with retry logic
   */
  async withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T> {
    const finalConfig = { ...this.config, ...config };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt, finalConfig);
          logger.info(`RetryHandler: Attempt ${attempt}/${finalConfig.maxRetries}, waiting ${delay}ms`);
          await this.sleep(delay);
        }

        const result = await fn();
        this.retryCount = 0;
        return result;
      } catch (error: any) {
        lastError = error;
        this.retryCount++;
        
        logger.warn(`RetryHandler: Attempt ${attempt} failed:`, error.message);
        
        // Don't retry on certain errors
        if (!this.shouldRetry(error)) {
          throw error;
        }
      }
    }

    const err = new Error(`RetryHandler: All ${finalConfig.maxRetries + 1} attempts failed`);
    if (lastError) {
      err.message += `: ${lastError.message}`;
    }
    throw err;
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(2, attempt);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: any): boolean {
    // Don't retry on invalid input errors
    if (error.message?.includes('Invalid')) return false;
    
    // Don't retry on authentication errors
    if (error.message?.includes('401') || error.message?.includes('403')) return false;
    
    // Retry on network errors, timeouts, and other transient errors
    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get queue length (for async retries)
   */
  getQueueLength(): number {
    return 0;
  }

  /**
   * Reset retry count
   */
  reset(): void {
    this.retryCount = 0;
  }
}
