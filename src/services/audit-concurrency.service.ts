import { logger } from '../utils/logger';

interface QueuedTask {
  id: string;
  type: string;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  startTime?: number;
}

export class AuditConcurrencyService {
  private static instance: AuditConcurrencyService;
  private readonly MAX_CONCURRENT = 2;
  private activeCount = 0;
  private queue: QueuedTask[] = [];
  private processing = false;

  static getInstance(): AuditConcurrencyService {
    if (!AuditConcurrencyService.instance) {
      AuditConcurrencyService.instance = new AuditConcurrencyService();
    }
    return AuditConcurrencyService.instance;
  }

  async enqueue<T>(id: string, type: string, execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask = {
        id,
        type,
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      };
      this.queue.push(task);
      logger.info({ type, id, queueLength: this.queue.length, activeCount: this.activeCount }, `[AuditQueue] Enqueued ${type} for ${id}`);
      if (!this.processing) {
        this.processNext();
      }
    });
  }

  private async processNext(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0 && this.activeCount < this.MAX_CONCURRENT) {
      const task = this.queue.shift();
      if (!task) break;

      this.activeCount++;
      task.startTime = Date.now();
      logger.info({ type: task.type, id: task.id, activeCount: this.activeCount }, `[AuditQueue] Starting ${task.type}`);

      this.executeTask(task).finally(() => {
        this.activeCount--;
        const duration = Date.now() - (task.startTime || Date.now());
        logger.info({ type: task.type, id: task.id, duration, activeCount: this.activeCount }, `[AuditQueue] Completed ${task.type}`);
        setImmediate(() => this.processNext());
      });
    }
    this.processing = this.queue.length > 0 || this.activeCount > 0;
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    try {
      const result = await task.execute();
      task.resolve(result);
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err), type: task.type, id: task.id }, `[AuditQueue] Task ${task.type} failed`);
      task.reject(err);
    }
  }

  getStatus(): { activeCount: number; queueLength: number; maxConcurrent: number } {
    return {
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      maxConcurrent: this.MAX_CONCURRENT,
    };
  }
}

export const auditConcurrency = AuditConcurrencyService.getInstance();
