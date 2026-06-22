import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../utils/logger';

export interface BrowserManager {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export class PlaywrightBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isClosed: boolean = false;

  async initialize(): Promise<BrowserManager> {
    try {
      if (this.isClosed) {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isClosed = false;
      }

      if (this.browser && this.browser.isConnected()) {
        logger.info('PlaywrightBrowser: Reusing existing browser');
        return {
          browser: this.browser,
          context: this.context!,
          page: this.page!,
        };
      }

      logger.info('PlaywrightBrowser: Launching new browser...');

      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        permissions: ['geolocation'],
        geolocation: { latitude: 23.0225, longitude: 72.5714 },
      });

      this.page = await this.context.newPage();

      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      this.browser.on('disconnected', () => {
        logger.warn('PlaywrightBrowser: Browser disconnected unexpectedly');
        this.isClosed = true;
      });

      logger.info('PlaywrightBrowser: Browser initialized successfully');

      return {
        browser: this.browser,
        context: this.context,
        page: this.page,
      };
    } catch (error) {
      this.isClosed = true;
      logger.error(error instanceof Error ? error : new Error(String(error)), 'PlaywrightBrowser: Failed to initialize browser:');
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      this.isClosed = true;
      logger.info('PlaywrightBrowser: Browser closed successfully');
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'PlaywrightBrowser: Error closing browser:');
      this.isClosed = true;
      throw error;
    }
  }

  async restart(): Promise<BrowserManager> {
    await this.close();
    return this.initialize();
  }

  async refreshPage(): Promise<Page> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    await this.page.reload({ waitUntil: 'networkidle' });
    return this.page;
  }

  isRunning(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  getManaged(): { browser: Browser; context: BrowserContext; page: Page } {
    if (!this.browser || !this.context || !this.page) {
      throw new Error('Browser not fully initialized');
    }
    return {
      browser: this.browser,
      context: this.context,
      page: this.page,
    };
  }
}
