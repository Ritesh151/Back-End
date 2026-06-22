import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { reportService } from './report.service';

interface QueueItem {
  leadId: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class ReportQueue extends EventEmitter {
  private queue: Map<string, QueueItem> = new Map();
  private processing = false;

  async enqueue(leadId: string): Promise<any> {
    const existing = this.queue.get(leadId);
    if (existing) {
      logger.info({ leadId }, '[ReportQueue] Already queued, skipping duplicate');
      return existing;
    }

    return new Promise((resolve, reject) => {
      this.queue.set(leadId, { leadId, resolve, reject });
      logger.info({ leadId, queueSize: this.queue.size }, '[ReportQueue] Enqueued report generation');
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.size === 0) return;
    this.processing = true;

    const entry = this.queue.values().next().value;
    if (!entry) {
      this.processing = false;
      return;
    }

    this.queue.delete(entry.leadId);

    try {
      logger.info({ leadId: entry.leadId }, '[ReportQueue] Processing report');
      this.emit('progress', { leadId: entry.leadId, stage: 'generating', percent: 10, message: 'Generating report...' });

      const result = await reportService.generateReport(entry.leadId);

      this.emit('progress', { leadId: entry.leadId, stage: 'complete', percent: 100, message: 'Report generated' });
      entry.resolve(result);
    } catch (error: unknown) {
      logger.error({ err: error instanceof Error ? error.message : String(error), leadId: entry.leadId }, '[ReportQueue] Generation failed');
      this.emit('progress', { leadId: entry.leadId, stage: 'error', percent: 0, message: 'Generation failed' });
      entry.reject(error);
    } finally {
      this.processing = false;
      setImmediate(() => this.processNext());
    }
  }

  isQueued(leadId: string): boolean {
    return this.queue.has(leadId);
  }

  getQueueSize(): number {
    return this.queue.size;
  }
}

export const reportQueue = new ReportQueue();
