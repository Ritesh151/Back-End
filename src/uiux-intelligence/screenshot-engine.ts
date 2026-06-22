import { Page } from 'playwright';
import { logger } from '../utils/logger';
import { ViewportConfig } from './types';
import path from 'path';
import fs from 'fs/promises';

export class ScreenshotEngine {
  private screenshotDir: string;

  private dirEnsured = false;

  constructor() {
    this.screenshotDir = path.join(process.cwd(), 'screenshots');
  }

  private async ensureScreenshotDir(): Promise<void> {
    if (this.dirEnsured) return;
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      this.dirEnsured = true;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to create screenshot directory:');
    }
  }

  async ensureReady(): Promise<void> {
    await this.ensureScreenshotDir();
  }

  async captureScreenshot(
    page: Page,
    viewport: ViewportConfig,
    url: string,
    quality: number = 80
  ): Promise<string | null> {
    try {
      await this.ensureReady();
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.waitForLoadState('load', { timeout: 15000 });
      await page.waitForTimeout(1000);

      const sanitizedUrl = this.sanitizeUrl(url);
      const filename = `${sanitizedUrl}_${viewport.name.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      const filepath = path.join(this.screenshotDir, filename);

      await page.screenshot({
        path: filepath,
        type: 'jpeg',
        quality,
        fullPage: false,
      });

      logger.info(`Screenshot captured: ${filename}`);
      return filepath;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to capture screenshot for ${url}:`);
      return null;
    }
  }

  async captureBase64Screenshot(
    page: Page,
    viewport: ViewportConfig,
    quality: number = 80
  ): Promise<string | null> {
    try {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.waitForLoadState('load', { timeout: 15000 });
      await page.waitForTimeout(1000);

      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality,
        fullPage: false,
      });

      return `data:image/jpeg;base64,${screenshot.toString('base64')}`;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to capture base64 screenshot:');
      return null;
    }
  }

  private sanitizeUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
  }

  async cleanupOldScreenshots(daysOld: number = 7): Promise<void> {
    try {
      const files = await fs.readdir(this.screenshotDir);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(this.screenshotDir, file);
        const stats = await fs.stat(filepath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filepath);
          logger.info(`Deleted old screenshot: ${file}`);
        }
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to cleanup old screenshots:');
    }
  }
}

export const screenshotEngine = new ScreenshotEngine();
