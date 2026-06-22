import { logger } from '../utils/logger';

interface QueueJob {
  leadId: string;
  callback: () => Promise<void>;
}

export class EmailDiscoveryQueue {
  private queue: Map<string, QueueJob> = new Map();
  private running: Set<string> = new Set();
  private maxConcurrent: number;

  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(leadId: string, callback: () => Promise<void>): void {
    if (this.queue.has(leadId) || this.running.has(leadId)) return;

    this.queue.set(leadId, { leadId, callback });
    this.processNext();
  }

  private processNext(): void {
    if (this.running.size >= this.maxConcurrent) return;
    if (this.queue.size === 0) return;

    for (const [leadId, job] of this.queue) {
      if (this.running.size >= this.maxConcurrent) break;
      if (this.running.has(leadId)) continue;

      this.queue.delete(leadId);
      this.running.add(leadId);

      job.callback()
        .catch((err) => {
          logger.error({ leadId, err: err instanceof Error ? err.message : String(err) }, 'EmailDiscoveryQueue: Job failed');
        })
        .finally(() => {
          this.running.delete(leadId);
          this.processNext();
        });
    }
  }

  get pendingCount(): number {
    return this.queue.size;
  }

  get runningCount(): number {
    return this.running.size;
  }
}

export const emailDiscoveryQueue = new EmailDiscoveryQueue(10);
