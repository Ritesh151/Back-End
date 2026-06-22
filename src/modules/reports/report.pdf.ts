import { logger } from '../../utils/logger';
import { browserPool } from '../../services/browser-pool.service';

const RENDER_TIMEOUT = 30000;

export class ReportPdfEngine {
  async generatePdf(html: string): Promise<Buffer> {
    const { page } = await browserPool.acquire('report-pdf');
    try {
      page.setDefaultTimeout(RENDER_TIMEOUT);
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: RENDER_TIMEOUT,
      });
      await page.waitForTimeout(500);
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px',
        },
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdfBuffer);
    } catch (error: unknown) {
      logger.error({ err: error instanceof Error ? error.message : String(error) }, '[ReportPdf] PDF generation failed');
      throw error;
    } finally {
      await browserPool.release(page, 'report-pdf');
    }
  }

  async captureScreenshot(html: string, viewport: { width: number; height: number }): Promise<Buffer> {
    const { page } = await browserPool.acquire('report-screenshot');
    try {
      page.setDefaultTimeout(RENDER_TIMEOUT);
      await page.setViewportSize(viewport);
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: RENDER_TIMEOUT,
      });
      await page.waitForTimeout(300);
      const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
      return Buffer.from(screenshot);
    } finally {
      await browserPool.release(page, 'report-screenshot');
    }
  }

  async close(): Promise<void> {
    // Browser pool handles cleanup
  }
}

export const reportPdfEngine = new ReportPdfEngine();
