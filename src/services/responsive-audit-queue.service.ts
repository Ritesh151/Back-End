import { EventEmitter } from 'events';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { responsiveAuditService } from './responsive-audit.service';
import pLimit from 'p-limit';

class ResponsiveAuditQueueService extends EventEmitter {
  private isProcessing = false;
  private readonly limit = pLimit(2);
  private readonly batchSize = 10;

  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.info('Responsive audit queue already processing');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting responsive audit queue processing');

    while (this.isProcessing) {
      try {
        const leads = await this.getLeadsToAudit();

        if (leads.length === 0) {
          logger.info('No leads to audit, waiting...');
          await this.sleep(60000);
          continue;
        }

        logger.info(`Processing ${leads.length} leads for responsive audit`);

        await Promise.all(
          leads.map(lead =>
            this.limit(async () => {
              try {
                await responsiveAuditService.auditLead(lead._id.toString(), {
                  timeout: 30000,
                  skipScreenshots: false,
                  screenshotQuality: 80,
                });
              } catch (error) {
                logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to audit lead ${lead._id}:`);
              }
            })
          )
        );

        await this.sleep(5000);
      } catch (error) {
        logger.error(error instanceof Error ? error : new Error(String(error)), 'Error in responsive audit queue:');
        await this.sleep(10000);
      }
    }
  }

  stopProcessing(): void {
    this.isProcessing = false;
    logger.info('Stopping responsive audit queue processing');
  }

  private async getLeadsToAudit(): Promise<Array<{ _id: string; website: string }>> {
    try {
      const leads = await Lead.find({
        website: { $exists: true, $nin: [null, ''] },
        analyzedAt: { $exists: true },
        responsiveAuditCompleted: { $ne: true },
      })
        .sort({ analyzedAt: -1 })
        .limit(this.batchSize)
        .select('_id website')
        .lean<Array<{ _id: string; website: string }>>();

      return leads;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to get leads to audit:');
      return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const responsiveAuditQueueService = new ResponsiveAuditQueueService();
