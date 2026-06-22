import { mkdir, writeFile, readFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../utils/logger';

const UPLOADS_ROOT = join(process.cwd(), 'uploads', 'reports');

export class ReportStorage {
  private async ensureDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }

  async savePdf(leadId: string, pdfBuffer: Buffer): Promise<string> {
    const dir = join(UPLOADS_ROOT, 'pdf');
    await this.ensureDir(dir);
    const filename = `${leadId}_${Date.now()}.pdf`;
    const filepath = join(dir, filename);
    await writeFile(filepath, pdfBuffer);
    logger.info({ leadId, filepath }, '[ReportStorage] PDF saved');
    return filepath;
  }

  async saveHtml(leadId: string, html: string): Promise<string> {
    const dir = join(UPLOADS_ROOT, 'html');
    await this.ensureDir(dir);
    const filename = `${leadId}_${Date.now()}.html`;
    const filepath = join(dir, filename);
    await writeFile(filepath, html, 'utf-8');
    logger.info({ leadId, filepath }, '[ReportStorage] HTML saved');
    return filepath;
  }

  async saveScreenshot(leadId: string, type: 'desktop' | 'mobile', buffer: Buffer): Promise<string> {
    const dir = join(UPLOADS_ROOT, 'screenshots');
    await this.ensureDir(dir);
    const filename = `${leadId}_${type}_${Date.now()}.png`;
    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);
    return filepath;
  }

  async getPdf(filepath: string): Promise<Buffer | null> {
    try {
      await access(filepath);
      return await readFile(filepath);
    } catch {
      return null;
    }
  }

  async getHtml(filepath: string): Promise<string | null> {
    try {
      await access(filepath);
      return await readFile(filepath, 'utf-8');
    } catch {
      return null;
    }
  }

  async deleteReport(filepath: string): Promise<boolean> {
    try {
      await unlink(filepath);
      return true;
    } catch {
      return false;
    }
  }

  getPdfUrl(filepath: string): string {
    const relative = filepath.replace(join(process.cwd(), 'uploads'), '');
    return `/uploads${relative}`;
  }

  getHtmlUrl(filepath: string): string {
    const relative = filepath.replace(join(process.cwd(), 'uploads'), '');
    return `/uploads${relative}`;
  }
}

export const reportStorage = new ReportStorage();
