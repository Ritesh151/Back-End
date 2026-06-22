import { Page } from 'playwright';
import { logger } from '../utils/logger';

export interface PageManagerOptions {
  defaultTimeout: number;
  navigationTimeout: number;
  extractionTimeout: number;
}

export class PageManager {
  private page: Page;
  private options: PageManagerOptions;

  constructor(page: Page, options: Partial<PageManagerOptions> = {}) {
    this.page = page;
    this.options = {
      defaultTimeout: 30000,
      navigationTimeout: 15000,
      extractionTimeout: 10000,
      ...options,
    };
    this.page.setDefaultTimeout(this.options.defaultTimeout);
  }

  /**
   * Navigate to URL with optimized wait
   */
  async navigate(url: string): Promise<void> {
    logger.info(`PageManager: Navigating to ${url}`);
    await this.page.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.options.navigationTimeout,
    });
    logger.info(`PageManager: Navigation to ${url} completed`);
  }

  /**
   * Click element with retry
   */
  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout || this.options.extractionTimeout;
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.page.click(selector, { timeout });
        return;
      } catch (error) {
        retryCount++;
        logger.warn(error instanceof Error ? error : new Error(String(error)), `PageManager: Click retry ${retryCount}/${maxRetries} for ${selector}`);
        if (retryCount >= maxRetries) {
          throw error;
        }
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Wait for selector with optimized timeout
   */
  async waitForSelector(selector: string, options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout || this.options.extractionTimeout;
    await this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  }

  /**
   * Get text content with null safety
   */
  async getText(selector: string): Promise<string | null> {
    try {
      const element = await this.page.$(selector);
      if (element) {
        return await element.innerText();
      }
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), `PageManager: Failed to get text for ${selector}`);
    }
    return null;
  }

  /**
   * Get attribute with null safety
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    try {
      const element = await this.page.$(selector);
      if (element) {
        return await element.getAttribute(attribute);
      }
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), `PageManager: Failed to get attribute for ${selector}`);
    }
    return null;
  }

  /**
   * Get count of elements
   */
  async count(selector: string): Promise<number> {
    try {
      return await this.page.locator(selector).count();
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), `PageManager: Failed to count elements for ${selector}`);
      return 0;
    }
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clear cache and cookies
   */
  async clearCache(): Promise<void> {
    await this.page.context().clearCookies();
  }

  /**
   * Get page metrics
   */
  getMetrics(): {
    url: string;
    width: number;
    height: number;
  } {
    return {
      url: this.page.url(),
      width: this.page.viewportSize()?.width || 1920,
      height: this.page.viewportSize()?.height || 1080,
    };
  }
}
