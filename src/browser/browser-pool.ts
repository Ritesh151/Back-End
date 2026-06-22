import { logger } from '../utils/logger';
import { PlaywrightBrowser } from '../browser/browser-manager';

export interface BrowserPoolOptions {
  maxBrowsers: number;
  headless: boolean;
}

export class BrowserPool {
  private browsers: Map<string, PlaywrightBrowser> = new Map();
  private options: BrowserPoolOptions;

  constructor(options: BrowserPoolOptions) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    logger.info(`BrowserPool: Initializing pool with max ${this.options.maxBrowsers} browsers`);
  }

  async acquire(sessionId: string): Promise<{
    browser: any;
    context: any;
    page: any;
  }> {
    if (!this.browsers.has(sessionId)) {
      if (this.browsers.size >= this.options.maxBrowsers) {
        const oldestSession = this.browsers.keys().next().value;
        if (oldestSession) {
          await this.release(oldestSession);
        }
      }

      const browserManager = new PlaywrightBrowser();
      await browserManager.initialize();
      this.browsers.set(sessionId, browserManager);
      logger.info(`BrowserPool: Acquired browser for session ${sessionId}`);
    }

    const browserManager = this.browsers.get(sessionId)!;
    const managed = browserManager.getManaged();
    return {
      browser: managed.browser,
      context: managed.context,
      page: managed.page,
    };
  }

  /**
   * Release a browser from a session
   */
  async release(sessionId: string): Promise<void> {
    const browserManager = this.browsers.get(sessionId);
    if (browserManager) {
      await browserManager.close();
      this.browsers.delete(sessionId);
      logger.info(`BrowserPool: Released browser for session ${sessionId}`);
    }
  }

  /**
   * Restart a browser for a session
   */
  async restart(sessionId: string): Promise<void> {
    logger.info(`BrowserPool: Restarting browser for session ${sessionId}`);
    await this.release(sessionId);
    await this.acquire(sessionId);
  }

  /**
   * Restart all browsers
   */
  async restartAll(): Promise<void> {
    logger.info('BrowserPool: Restarting all browsers');
    for (const sessionId of this.browsers.keys()) {
      await this.restart(sessionId);
    }
  }

  /**
   * Close all browsers
   */
  async closeAll(): Promise<void> {
    logger.info('BrowserPool: Closing all browsers');
    for (const sessionId of this.browsers.keys()) {
      await this.release(sessionId);
    }
  }

  /**
   * Get active browser count
   */
  getActiveCount(): number {
    return this.browsers.size;
  }

  /**
   * Get browser count
   */
  getBrowserCount(): number {
    return this.browsers.size;
  }

  /**
   * Get browser by session ID
   */
  getBrowser(sessionId: string): PlaywrightBrowser | undefined {
    return this.browsers.get(sessionId);
  }

  /**
   * Check if session has a browser
   */
  hasSession(sessionId: string): boolean {
    return this.browsers.has(sessionId);
  }
}
