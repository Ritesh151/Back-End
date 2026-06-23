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

  async initialize(): Promise<BrowserManager> {
    try {
      logger.info('Launching browser...');

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
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        permissions: ['geolocation'],
        geolocation: { latitude: 23.0225, longitude: 72.5714 }, // Ahmedabad coordinates
      });

      this.page = await this.context.newPage();

      // Override the navigator.webdriver property
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      logger.info('Browser initialized successfully');

      return {
        browser: this.browser,
        context: this.context,
        page: this.page,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to initialize browser:');
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('Browser closed successfully');
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Error closing browser:');
      throw error;
    }
  }

  async refreshPage(): Promise<Page> {
    if (this.page) {
      await this.page.reload({ waitUntil: 'networkidle' });
      return this.page;
    }
    throw new Error('Browser not initialized');
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
