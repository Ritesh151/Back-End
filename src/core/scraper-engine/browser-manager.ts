import { Browser, BrowserContext, Page, chromium, firefox, BrowserType } from 'playwright';
import { logger } from '../../utils/logger';

export type BrowserEngine = 'chromium' | 'firefox';

interface ManagedBrowser {
  browser: Browser;
  context: BrowserContext;
  pages: Set<Page>;
  lastUsed: number;
  inUse: boolean;
  createdAt: number;
  crashed: boolean;
  browserType: BrowserEngine;
}

const CHROMIUM_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-webgl',
  '--disable-accelerated-2d-canvas',
  '--disable-extensions',
  '--window-size=1920,1080',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-session-crashed-bubble',
  '--disable-crash-reporter',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-component-extensions-with-background-pages',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-first-run',
];

const FIREFOX_ARGS = [
  '--no-sandbox',
];

const CHROMIUM_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const FIREFOX_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
];

const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'media', 'font', 'stylesheet', 'imageset', 'svg', 'beacon', 'csp_report', 'ping',
]);

const BLOCKED_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'facebook.net', 'facebook.com/tr',
  'doubleclick.net', 'cdn.cookie-script.com', 'cdn.userway.org', 'cdn.onesignal.com',
  'hotjar.com', 'clarity.ms', 'bat.bing.com', 'adservice.google.com', 'pagead2.googlesyndication.com',
  'fundingchoicesmessages.google.com', 'mc.yandex.ru', 'www.googleadservices.com',
];

const MAX_POOL_SIZE = 3;
const BROWSER_IDLE_TIMEOUT_MS = 180000;
const PAGE_TIMEOUT_MS = 45000;
const BROWSER_LAUNCH_TIMEOUT_MS = 20000;
const CLEANUP_INTERVAL_MS = 30000;
const MAX_PAGES_PER_BROWSER = 8;

export class BrowserManager {
  private pool: ManagedBrowser[] = [];
  private maxSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private totalPagesCreated = 0;
  private totalPagesClosed = 0;
  private browserCrashes = 0;
  private userAgentIndex = 0;

  constructor(maxSize = MAX_POOL_SIZE) {
    this.maxSize = maxSize;
    this.startCleanupTimer();
    logger.info({ maxPoolSize: this.maxSize, idleTimeoutMs: BROWSER_IDLE_TIMEOUT_MS }, 'BrowserManager: Initialized');
  }

  async acquire(sourceName: string, browserType: BrowserEngine = 'chromium'): Promise<{ page: Page; browser: Browser; context: BrowserContext }> {
    const pooled = this.findAvailableBrowser(browserType);
    const browserInstance = pooled || await this.launchNewBrowser(browserType);
    if (!browserInstance) {
      throw new Error(`BrowserManager: Failed to acquire ${browserType} browser instance`);
    }

    browserInstance.inUse = true;
    browserInstance.lastUsed = Date.now();

    const page = await browserInstance.context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);

    await this.setupPage(page);
    browserInstance.pages.add(page);
    this.totalPagesCreated++;

    logger.debug({
      source: sourceName,
      browserType,
      poolSize: this.pool.length,
      activePages: browserInstance.pages.size,
      totalCreated: this.totalPagesCreated,
    }, 'BrowserManager: Page acquired');

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
          this.totalPagesClosed++;
        } catch {
          // page already closed
        }

        logger.debug({
          source: sourceName,
          remainingPages: pooled.pages.size,
          totalClosed: this.totalPagesClosed,
        }, 'BrowserManager: Page released');
      }
    } catch (error) {
      logger.warn({
        err: error instanceof Error ? error.message : String(error),
        source: sourceName,
      }, 'BrowserManager: Release error');
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    logger.info({ poolSize: this.pool.length }, 'BrowserManager: Shutting down');

    for (const pooled of this.pool) {
      await this.destroyBrowser(pooled);
    }
    this.pool = [];
  }

  getStatus(): {
    poolSize: number;
    activeBrowsers: number;
    idleBrowsers: number;
    totalPagesCreated: number;
    totalPagesClosed: number;
    browserCrashes: number;
    memoryUsageMB: number;
  } {
    const active = this.pool.filter(p => p.inUse).length;
    const idle = this.pool.filter(p => !p.inUse).length;
    const mem = process.memoryUsage();
    return {
      poolSize: this.pool.length,
      activeBrowsers: active,
      idleBrowsers: idle,
      totalPagesCreated: this.totalPagesCreated,
      totalPagesClosed: this.totalPagesClosed,
      browserCrashes: this.browserCrashes,
      memoryUsageMB: Math.round(mem.heapUsed / 1024 / 1024),
    };
  }

  async handleCrash(browser: Browser): Promise<void> {
    this.browserCrashes++;
    const pooled = this.pool.find(p => p.browser === browser);
    if (pooled) {
      pooled.crashed = true;
      pooled.inUse = false;
      this.pool = this.pool.filter(p => p !== pooled);
      logger.warn({
        poolSize: this.pool.length,
        totalCrashes: this.browserCrashes,
      }, 'BrowserManager: Browser crashed, removed from pool');
    }
  }

  private findAvailableBrowser(browserType: BrowserEngine): ManagedBrowser | null {
    const available = this.pool.filter(
      p => !p.inUse && !p.crashed && p.pages.size < MAX_PAGES_PER_BROWSER && p.browserType === browserType
    );
    if (available.length === 0) return null;
    return available.sort((a, b) => a.lastUsed - b.lastUsed)[0];
  }

  private getBrowserType(source: BrowserEngine): BrowserType<Browser> {
    return source === 'firefox' ? firefox : chromium;
  }

  private getUserAgent(browserType: BrowserEngine): string {
    const agents = browserType === 'firefox' ? FIREFOX_USER_AGENTS : CHROMIUM_USER_AGENTS;
    const ua = agents[this.userAgentIndex % agents.length];
    this.userAgentIndex++;
    return ua;
  }

  private async launchNewBrowser(browserType: BrowserEngine): Promise<ManagedBrowser | null> {
    if (this.pool.length >= this.maxSize) {
      // Try to reuse an idle browser of the same type
      const sameTypeIdle = this.pool
        .filter(p => !p.inUse && !p.crashed && p.browserType === browserType)
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];

      if (sameTypeIdle) {
        logger.info({ browserType }, 'BrowserManager: Reusing idle browser');
        for (const page of sameTypeIdle.pages) {
          try { await page.close(); this.totalPagesClosed++; } catch { }
        }
        sameTypeIdle.pages.clear();
        sameTypeIdle.inUse = true;
        return sameTypeIdle;
      }

      // Try any idle browser regardless of type
      const anyIdle = this.pool
        .filter(p => !p.inUse && !p.crashed)
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];

      if (anyIdle) {
        logger.info({ browserType, reusingType: anyIdle.browserType }, 'BrowserManager: Reusing any idle browser');
        for (const page of anyIdle.pages) {
          try { await page.close(); this.totalPagesClosed++; } catch { }
        }
        anyIdle.pages.clear();
        anyIdle.inUse = true;
        return anyIdle;
      }

      const crashedBrowser = this.pool.find(p => p.crashed);
      if (crashedBrowser) {
        this.pool = this.pool.filter(p => p !== crashedBrowser);
        logger.info({}, 'BrowserManager: Removed crashed browser, launching new');
        return this.launchNewBrowser(browserType);
      }

      throw new Error('BrowserManager: Max pool size reached and no idle browsers available');
    }

    const userAgent = this.getUserAgent(browserType);
    const browserEngine = this.getBrowserType(browserType);
    const launchArgs = browserType === 'firefox' ? FIREFOX_ARGS : CHROMIUM_ARGS;

    try {
      const browser = await browserEngine.launch({
        headless: true,
        args: launchArgs,
        timeout: BROWSER_LAUNCH_TIMEOUT_MS,
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });

      browser.on('disconnected', () => {
        this.handleCrash(browser);
      });

      const contextOptions: Record<string, unknown> = {
        viewport: { width: 1920, height: 1080 },
        userAgent,
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        ignoreHTTPSErrors: true,
      };

      if (browserType === 'chromium') {
        Object.assign(contextOptions, {
          geolocation: { latitude: 23.0225, longitude: 72.5714 },
          permissions: ['geolocation'],
          deviceScaleFactor: 1,
          screen: { width: 1920, height: 1080 },
        });
      }

      const context = await browser.newContext(contextOptions);

      if (browserType === 'chromium') {
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] as unknown as PluginArray });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          (window as any).chrome = { runtime: {} };
        });
      }

      const pooled: ManagedBrowser = {
        browser, context, pages: new Set(),
        lastUsed: Date.now(), inUse: true,
        createdAt: Date.now(), crashed: false,
        browserType,
      };

      this.pool.push(pooled);
      logger.info({
        poolSize: this.pool.length, maxSize: this.maxSize, browserType,
      }, 'BrowserManager: New browser launched');
      return pooled;
    } catch (error) {
      logger.error({
        err: error instanceof Error ? error.message : String(error),
        poolSize: this.pool.length, browserType,
      }, 'BrowserManager: Failed to launch browser');
      return null;
    }
  }

  private async setupPage(page: Page): Promise<void> {
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

  private async destroyBrowser(pooled: ManagedBrowser): Promise<void> {
    try {
      for (const page of pooled.pages) {
        try { await page.close(); this.totalPagesClosed++; } catch { }
      }
      pooled.pages.clear();
      try { await pooled.context.close(); } catch { }
      try { await pooled.browser.close(); } catch { }
    } catch { }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      const now = Date.now();
      const toRemove: ManagedBrowser[] = [];

      for (const pooled of this.pool) {
        if (pooled.crashed) {
          toRemove.push(pooled);
          continue;
        }
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
        }, 'BrowserManager: Idle browser cleaned up');
      }
    }, CLEANUP_INTERVAL_MS);
  }
}

export const browserManager = new BrowserManager(MAX_POOL_SIZE);
