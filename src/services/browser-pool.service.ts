import { Browser, Page, chromium, BrowserContext } from 'playwright';
import { logger } from '../utils/logger';

interface PooledBrowser {
  browser: Browser;
  context: BrowserContext;
  pages: Set<Page>;
  lastUsed: number;
  inUse: boolean;
}

const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-webgl',
  '--disable-accelerated-2d-canvas',
  '--window-size=1920,1080',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'media', 'font', 'stylesheet',
  'imageset', 'svg', 'beacon',
]);

const BLOCKED_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'facebook.com/tr',
  'doubleclick.net',
  'cdn.cookie-script.com',
  'cdn.userway.org',
  'cdn.onesignal.com',
  'hotjar.com',
  'clarity.ms',
  'bat.bing.com',
];

const MAX_POOL_SIZE = 3;
const BROWSER_IDLE_TIMEOUT_MS = 120000;
const PAGE_TIMEOUT_MS = 30000;
const BROWSER_LAUNCH_TIMEOUT_MS = 15000;

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private maxSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize = MAX_POOL_SIZE) {
    this.maxSize = maxSize;
    this.startCleanupTimer();
    logger.info({
      maxPoolSize: this.maxSize,
      idleTimeoutMs: BROWSER_IDLE_TIMEOUT_MS,
    }, 'BrowserPool: Initialized');
  }

  async acquire(sourceName: string): Promise<{ page: Page; browser: Browser; context: BrowserContext }> {
    const pooled = this.findIdleBrowser();
    const browserInstance = pooled || await this.launchNewBrowser();
    if (!browserInstance) {
      throw new Error('BrowserPool: Failed to acquire browser instance');
    }

    browserInstance.inUse = true;
    browserInstance.lastUsed = Date.now();

    const page = await browserInstance.context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);

    await this.setupPageAborts(page);
    browserInstance.pages.add(page);

    logger.debug({
      source: sourceName,
      poolSize: this.pool.length,
      activePages: browserInstance.pages.size,
    }, 'BrowserPool: Page acquired');

    return { page, browser: browserInstance.browser, context: browserInstance.context };
  }

  async release(page: Page, sourceName: string): Promise<void> {
    try {
      const pooled = this.pool.find(p => p.pages.has(page));
      if (pooled) {
        pooled.pages.delete(page);
        pooled.lastUsed = Date.now();
        pooled.inUse = pooled.pages.size > 0;

        try {
          await page.close();
        } catch {
          // page already closed
        }

        logger.debug({
          source: sourceName,
          remainingPages: pooled.pages.size,
        }, 'BrowserPool: Page released');
      }
    } catch (error: unknown) {
      logger.warn({
        err: error instanceof Error ? error.message : String(error),
        source: sourceName,
      }, 'BrowserPool: Release error');
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    logger.info({ poolSize: this.pool.length }, 'BrowserPool: Shutting down');

    for (const pooled of this.pool) {
      await this.destroyBrowser(pooled);
    }
    this.pool = [];
  }

  getStatus(): { poolSize: number; activeBrowsers: number; idleBrowsers: number } {
    const active = this.pool.filter(p => p.inUse).length;
    const idle = this.pool.filter(p => !p.inUse).length;
    return { poolSize: this.pool.length, activeBrowsers: active, idleBrowsers: idle };
  }

  private findIdleBrowser(): PooledBrowser | null {
    return this.pool.find(p => !p.inUse && p.pages.size < 5) || null;
  }

  private async launchNewBrowser(): Promise<PooledBrowser | null> {
    if (this.pool.length >= this.maxSize) {
      const oldestIdle = this.pool
        .filter(p => !p.inUse)
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];

      if (oldestIdle) {
        logger.info({}, 'BrowserPool: Reusing oldest idle browser');
        oldestIdle.inUse = true;
        return oldestIdle;
      }
      throw new Error('BrowserPool: Max pool size reached and no idle browsers available');
    }

    try {
      const browser = await chromium.launch({
        headless: true,
        args: BROWSER_ARGS,
        timeout: BROWSER_LAUNCH_TIMEOUT_MS,
      });

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: USER_AGENT,
        locale: 'en-US',
        timezoneId: 'Asia/Kolkata',
        geolocation: { latitude: 23.0225, longitude: 72.5714 },
        permissions: ['geolocation'],
        ignoreHTTPSErrors: true,
      });

      const pooled: PooledBrowser = {
        browser,
        context,
        pages: new Set(),
        lastUsed: Date.now(),
        inUse: true,
      };

      this.pool.push(pooled);
      logger.info({
        poolSize: this.pool.length,
        maxSize: this.maxSize,
      }, 'BrowserPool: New browser launched');
      return pooled;
    } catch (error: unknown) {
      logger.error({
        err: error instanceof Error ? error.message : String(error),
        poolSize: this.pool.length,
      }, 'BrowserPool: Failed to launch browser');
      return null;
    }
  }

  private async setupPageAborts(page: Page): Promise<void> {
    await page.route('**/*', async (route) => {
      const url = route.request().url().toLowerCase();
      const resourceType = route.request().resourceType();

      if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
        await route.abort();
        return;
      }

      for (const domain of BLOCKED_DOMAINS) {
        if (url.includes(domain)) {
          await route.abort();
          return;
        }
      }

      await route.continue();
    });
  }

  private async destroyBrowser(pooled: PooledBrowser): Promise<void> {
    try {
      for (const page of pooled.pages) {
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
      pooled.pages.clear();

      try {
        await pooled.context.close();
      } catch {
        // ignore
      }

      try {
        await pooled.browser.close();
      } catch {
        // ignore
      }
    } catch {
      // ignore cleanup errors
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      const now = Date.now();
      const toRemove: PooledBrowser[] = [];

      for (const pooled of this.pool) {
        if (!pooled.inUse && (now - pooled.lastUsed) > BROWSER_IDLE_TIMEOUT_MS) {
          toRemove.push(pooled);
        }
      }

      for (const pooled of toRemove) {
        this.pool = this.pool.filter(p => p !== pooled);
        await this.destroyBrowser(pooled);
        logger.info({
          idleTimeMs: now - pooled.lastUsed,
          poolSize: this.pool.length,
        }, 'BrowserPool: Idle browser cleaned up');
      }
    }, 30000);
  }
}

export const browserPool = new BrowserPool(MAX_POOL_SIZE);
