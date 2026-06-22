import { Lead } from '../models/Lead';
import type { AuditStatusValue } from '../models/Lead';
import { logger } from '../utils/logger';
import { responsiveAuditService } from './responsive-audit.service';
import { businessIntelligenceService } from './business-intelligence.service';
import { browserPool } from './browser-pool.service';
import pLimit from 'p-limit';

interface QueuedLead {
  leadId: string;
  website: string;
}

interface ProcessResult {
  leadId: string;
  responsiveSuccess: boolean;
  intelligenceSuccess: boolean;
  error?: string;
}

export class LeadAuditProcessor {
  private readonly maxConcurrent = 3;
  private readonly limit = pLimit(this.maxConcurrent);
  private queue: QueuedLead[] = [];
  private processing = false;
  private totalEnqueued = 0;
  private totalCompleted = 0;
  private results: ProcessResult[] = [];

  enqueueLead(leadId: string, website: string): void {
    this.queue.push({ leadId, website });
    this.totalEnqueued++;
    logger.info(`[LeadAuditProcessor] Enqueued lead ${leadId} (total: ${this.totalEnqueued})`);

    if (!this.processing) {
      void this.processQueue();
    }
  }

  enqueueMany(leadIds: Array<{ leadId: string; website: string }>): void {
    const batch = leadIds.slice(0, 10);
    for (const item of batch) {
      this.queue.push(item);
      this.totalEnqueued++;
    }
    logger.info(`[LeadAuditProcessor] Enqueued ${batch.length} leads (total: ${this.totalEnqueued})`);

    if (!this.processing) {
      void this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    logger.info(`[LeadAuditProcessor] Starting queue processing with ${this.queue.length} leads`);

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, 10);

      const processPromises = batch.map(item =>
        this.limit(() => this.processSingleLead(item))
      );

      const batchResults = await Promise.allSettled(processPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          this.results.push(result.value);
        }
      }

      this.totalCompleted += batch.length;
      logger.info(`[LeadAuditProcessor] Completed ${this.totalCompleted}/${this.totalEnqueued} leads`);
    }

    this.processing = false;
    logger.info(`[LeadAuditProcessor] Queue processing complete (${this.totalCompleted}/${this.totalEnqueued})`);

    await browserPool.shutdown();
  }

  private async processSingleLead(item: QueuedLead): Promise<ProcessResult> {
    const { leadId } = item;
    const result: ProcessResult = { leadId, responsiveSuccess: false, intelligenceSuccess: false };

    try {
      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          'auditStatus.responsive': 'running',
          'auditStatus.intelligence': 'running',
          'auditStatus.overall': 'running',
        },
      });

      const [auditResult, intelligenceResult] = await Promise.allSettled([
        responsiveAuditService.auditLead(leadId).catch(err => {
          logger.error(err, `[LeadAuditProcessor] Responsive audit failed for ${leadId}`);
          return null;
        }),
        businessIntelligenceService.analyzeLead(leadId).catch(err => {
          logger.error(err, `[LeadAuditProcessor] Intelligence analysis failed for ${leadId}`);
          return null;
        }),
      ]);

      const responsiveSuccess = auditResult.status === 'fulfilled' && auditResult.value !== null;
      const intelligenceSuccess = intelligenceResult.status === 'fulfilled' && intelligenceResult.value !== null;

      result.responsiveSuccess = responsiveSuccess;
      result.intelligenceSuccess = intelligenceSuccess;

      const responsiveAuditValue: AuditStatusValue = responsiveSuccess ? 'completed' : 'failed';
      const intelligenceAuditValue: AuditStatusValue = intelligenceSuccess ? 'completed' : 'failed';
      const overallAuditValue: AuditStatusValue =
        responsiveSuccess && intelligenceSuccess ? 'completed' : 'failed';

      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          'auditStatus.responsive': responsiveAuditValue,
          'auditStatus.intelligence': intelligenceAuditValue,
          'auditStatus.overall': overallAuditValue,
        },
      });

      logger.info(`[LeadAuditProcessor] Processed lead ${leadId}: responsive=${responsiveAuditValue}, intelligence=${intelligenceAuditValue}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.error = errorMsg;
      logger.error(error instanceof Error ? error : new Error(errorMsg), `[LeadAuditProcessor] Failed to process lead ${leadId}`);

      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          'auditStatus.responsive': 'failed',
          'auditStatus.intelligence': 'failed',
          'auditStatus.overall': 'failed',
        },
      }).catch(() => {});
    }

    return result;
  }

  getQueueStats() {
    return {
      enqueued: this.totalEnqueued,
      completed: this.totalCompleted,
      pending: this.queue.length,
      processing: this.processing,
    };
  }
}

export const leadAuditProcessor = new LeadAuditProcessor();
