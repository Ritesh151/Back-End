import { logger } from '../utils/logger';
import { BrowserPool } from '../browser/browser-pool';

export interface CrashRecoveryOptions {
  maxRestartAttempts: number;
  restartCooldown: number;
}

export class CrashRecovery {
  private browserPool: BrowserPool;
  private restartCount: Map<string, number> = new Map();
  private options: CrashRecoveryOptions;

  constructor(browserPool: BrowserPool, options: Partial<CrashRecoveryOptions> = {}) {
    this.browserPool = browserPool;
    this.options = {
      maxRestartAttempts: 3,
      restartCooldown: 5000,
      ...options,
    };
  }

  /**
   * Handle browser crash for a session
   */
  async handleCrash(sessionId: string): Promise<boolean> {
    logger.warn(`CrashRecovery: Handling crash for session ${sessionId}`);

    // Check restart attempts
    const currentAttempts = this.restartCount.get(sessionId) || 0;
    if (currentAttempts >= this.options.maxRestartAttempts) {
      logger.error(`CrashRecovery: Max restart attempts reached for session ${sessionId}`);
      return false;
    }

    // Wait for cooldown
    if (currentAttempts > 0) {
      logger.info(`CrashRecovery: Waiting ${this.options.restartCooldown}ms before restart`);
      await this.sleep(this.options.restartCooldown);
    }

    // Attempt restart
    try {
      await this.browserPool.restart(sessionId);
      this.restartCount.set(sessionId, currentAttempts + 1);
      
      logger.info(`CrashRecovery: Successfully restarted session ${sessionId}`);
      return true;
    } catch (error: any) {
      logger.error(`CrashRecovery: Failed to restart session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Reset restart count for a session
   */
  reset(sessionId: string): void {
    this.restartCount.delete(sessionId);
    logger.info(`CrashRecovery: Reset restart count for session ${sessionId}`);
  }

  /**
   * Get restart count for a session
   */
  getRestartCount(sessionId: string): number {
    return this.restartCount.get(sessionId) || 0;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
