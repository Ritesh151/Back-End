import crypto from 'crypto';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { aiPipelineService } from './ai-pipeline.service';

const MAX_CONCURRENT = 3;

interface QueueEntry {
  leadId: string;
  enqueuedAt: Date;
}

export class AIProcessingQueue {
  private activeCount = 0;
  private queue: QueueEntry[] = [];
  private processing = false;
  private processingSet = new Set<string>();
  private initialEnqueueDone = false;

  async enqueueLead(leadId: string): Promise<void> {
    if (this.processingSet.has(leadId)) {
      logger.debug(`[AIQueue] Lead ${leadId} already in queue or processing, skipping`);
      return;
    }

    const lead = await Lead.findById(leadId).select('aiStatus aiWebsiteHash website').lean() as Record<string, unknown> | null;
    if (!lead) return;

    const aiStatus = lead.aiStatus as string | undefined;
    const aiWebsiteHash = lead.aiWebsiteHash as string | undefined;
    const website = lead.website as string | undefined;

    if (aiStatus === 'completed' && aiWebsiteHash) {
      const currentHash = this.computeWebsiteHash(website);
      if (currentHash === aiWebsiteHash) {
        logger.debug(`[AIQueue] Lead ${leadId} already completed with same hash, skipping`);
        return;
      }
    }

    this.processingSet.add(leadId);
    this.queue.push({ leadId, enqueuedAt: new Date() });

    await Lead.findByIdAndUpdate(leadId, {
      $set: { aiStatus: 'queued', aiProgress: 0, aiCurrentStep: 'Waiting in queue' },
    });

    logger.info(`[AIQueue] Enqueued lead ${leadId} (queue length: ${this.queue.length}, active: ${this.activeCount})`);

    if (!this.processing) {
      void this.processNext();
    }
  }

  enqueueMultiple(leadIds: string[]): void {
    for (const leadId of leadIds) {
      void this.enqueueLead(leadId);
    }
  }

  async enqueueAllPendingLeads(limit = 50): Promise<number> {
    const pendingLeads = await Lead.find({
      website: { $exists: true, $nin: [null, ''] },
      $or: [
        { aiStatus: { $in: ['pending', null] } },
        { aiStatus: { $exists: false } },
      ],
    })
      .limit(limit)
      .select('_id')
      .lean();

    if (pendingLeads.length === 0) {
      logger.info('[AIQueue] No pending leads found for initial enqueue');
      return 0;
    }

    logger.info(`[AIQueue] Found ${pendingLeads.length} pending leads for initial enqueue`);

    for (const lead of pendingLeads) {
      const leadRecord = lead as Record<string, unknown>;
      void this.enqueueLead(String(leadRecord._id));
    }

    this.initialEnqueueDone = true;
    return pendingLeads.length;
  }

  async enqueuePendingOnStartup(): Promise<void> {
    if (this.initialEnqueueDone) return;
    await this.enqueueAllPendingLeads(50);
  }

  getStatus(): { activeCount: number; queueLength: number; maxConcurrent: number } {
    return {
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      maxConcurrent: MAX_CONCURRENT,
    };
  }

  private processNext(): void {
    this.processing = true;

    while (this.queue.length > 0 && this.activeCount < MAX_CONCURRENT) {
      const entry = this.queue.shift();
      if (!entry) break;

      this.activeCount++;

      setImmediate(() => {
        void this.executePipeline(entry.leadId).finally(() => {
          this.activeCount--;
          this.processingSet.delete(entry.leadId);
          setImmediate(() => {
            void this.processNext();
          });
        });
      });
    }

    this.processing = this.queue.length > 0 || this.activeCount > 0;
  }

  private async executePipeline(leadId: string): Promise<void> {
    try {
      logger.info(`[AIQueue] Starting pipeline for lead ${leadId}`);
      const result = await aiPipelineService.runPipeline(leadId);
      if (!result.success) {
        logger.warn({ leadId, errors: result.errors }, '[AIQueue] Pipeline completed with errors');
      } else {
        logger.info(`[AIQueue] Pipeline completed successfully for lead ${leadId}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errMsg, leadId }, '[AIQueue] Pipeline execution failed');
      try {
        await Lead.findByIdAndUpdate(leadId, {
          $set: { aiStatus: 'failed', aiError: errMsg, processingCompletedAt: new Date() },
        });
      } catch {
        // ignore error during error handling
      }
    }
  }

  private computeWebsiteHash(website: string | undefined): string {
    if (!website) return '';
    return crypto.createHash('md5').update(website.toLowerCase().trim()).digest('hex');
  }
}

export const aiProcessingQueue = new AIProcessingQueue();
