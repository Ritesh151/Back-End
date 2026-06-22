import cron from 'node-cron';
import { logger } from '../utils/logger';
import { Automation, IAutomation } from '../models/Automation';
import { leadGenerationJob } from '../jobs/lead-generation.job';
import { websiteAnalysisJob } from '../jobs/website-analysis.job';
import { contactExtractionJob } from '../jobs/contact-extraction.job';
import { exportGenerationJob } from '../jobs/export-generation.job';
import { Lead } from '../models/Lead';
import { AutomationHistory } from '../models/Automation';

export class CronScheduler {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    logger.info('CronScheduler: Starting scheduled jobs');

    // Run initial check for pending automations
    await this.checkPendingAutomations();

    // Schedule periodic check every 5 minutes
    this.cronJobs.set('periodic-check', cron.schedule('*/5 * * * *', () => {
      this.checkPendingAutomations();
    }));

    logger.info('CronScheduler: Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    logger.info('CronScheduler: Stopping scheduled jobs');

    for (const [name, job] of this.cronJobs) {
      try {
        job.stop();
        logger.info(`CronScheduler: Stopped job: ${name}`);
      } catch (error) {
        logger.error(error instanceof Error ? error : new Error(String(error)), `CronScheduler: Failed to stop job ${name}:`);
      }
    }

    this.cronJobs.clear();
  }

  /**
   * Schedule an automation job
   */
  async scheduleAutomation(automationId: string): Promise<void> {
    const automation = await Automation.findById(automationId);

    if (!automation) {
      logger.warn(`CronScheduler: Automation not found: ${automationId}`);
      return;
    }

    const cronExpression = this.getCronExpression(automation.frequency);
    const jobKey = `automation-${automationId}`;

    // Cancel existing job if any
    if (this.cronJobs.has(jobKey)) {
      this.cronJobs.get(jobKey)?.stop();
    }

    // Schedule new job
    const task = cron.schedule(cronExpression, async () => {
      await this.runAutomation(automation);
    });

    this.cronJobs.set(jobKey, task);
    logger.info(`CronScheduler: Scheduled automation ${automationId} with frequency: ${automation.frequency}`);
  }

  /**
   * Cancel a scheduled automation job
   */
  async cancelAutomation(automationId: string): Promise<void> {
    const jobKey = `automation-${automationId}`;

    if (this.cronJobs.has(jobKey)) {
      this.cronJobs.get(jobKey)?.stop();
      this.cronJobs.delete(jobKey);
      logger.info(`CronScheduler: Cancelled automation ${automationId}`);
    }
  }

  /**
   * Get cron expression from frequency
   */
  private getCronExpression(frequency: 'hourly' | 'daily' | 'weekly'): string {
    switch (frequency) {
      case 'hourly':
        return '0 * * * *'; // Every hour
      case 'daily':
        return '0 9 * * *'; // Every day at 9 AM
      case 'weekly':
        return '0 9 * * 1'; // Every Monday at 9 AM
      default:
        return '0 9 * * *'; // Default to daily
    }
  }

  /**
   * Check and run pending automations
   */
  private async checkPendingAutomations(): Promise<void> {
    try {
      const now = new Date();
      const automations = await Automation.find({
        status: 'active',
        nextRunAt: { $lte: now },
      });

      if (automations.length === 0) {
        return;
      }

      logger.info(`CronScheduler: Found ${automations.length} pending automations`);

      for (const automation of automations) {
        try {
          await this.runAutomation(automation);
        } catch (error) {
          logger.error(error instanceof Error ? error : new Error(String(error)), `CronScheduler: Failed to run automation ${automation.id}:`);
        }
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'CronScheduler: Failed to check pending automations:');
    }
  }

  /**
   * Run an automation workflow
   */
  private async runAutomation(automation: IAutomation): Promise<void> {
    logger.info(`CronScheduler: Running automation ${automation.id} - ${automation.keyword}`);

    // Update next run time
    const nextRunAt = this.calculateNextRun(automation.frequency);
    await Automation.findByIdAndUpdate(automation.id, { nextRunAt });

    // Create history record
    const history = new AutomationHistory({
      automationId: automation.id,
      triggerType: 'scheduled',
      totalLeadsGenerated: 0,
      status: 'partial',
      executionTime: 0,
    });

    const startTime = Date.now();

    try {
      // Step 1: Scrape leads
      const scrapeResult = await leadGenerationJob.execute({
        automationId: automation.id,
        keyword: automation.keyword,
        location: automation.location,
        limit: automation.limit,
      });

      if (!scrapeResult.success) {
        throw new Error('Lead generation failed');
      }

      history.totalLeadsGenerated = scrapeResult.leadsGenerated;

      // Step 2: Get lead IDs for analysis and extraction
      const leads = await Lead.find({
        source: 'google-maps',
        createdAt: { $gte: new Date(Date.now() - 60000) }, // Last minute
      }).limit(automation.limit);

      const leadIds = leads.map(l => l.id);

      // Step 3: Analyze websites (if leads were generated)
      if (leadIds.length > 0) {
        await websiteAnalysisJob.execute({
          automationId: automation.id,
          leadIds,
        });
      }

      // Step 4: Extract contacts (if leads were generated)
      if (leadIds.length > 0) {
        await contactExtractionJob.execute({
          automationId: automation.id,
          leadIds,
        });
      }

      // Step 5: Generate export (optional)
      const filters = {
        search: automation.keyword,
        category: automation.category,
      };

      await exportGenerationJob.execute({
        automationId: automation.id,
        exportType: 'excel',
        filters,
      });

      history.status = 'success';
      logger.info(`CronScheduler: Automation ${automation.id} completed successfully`);

    } catch (error: any) {
      history.status = 'failed';
      history.error = error.message;
      logger.error(`CronScheduler: Automation ${automation.id} failed:`, error);
    } finally {
      history.executionTime = (Date.now() - startTime) / 1000; // in seconds
      await history.save();

      // Update automation stats
      await Automation.findByIdAndUpdate(automation.id, {
        lastRunAt: new Date(),
        lastRunStatus: history.status,
        lastRunLeads: history.totalLeadsGenerated,
        error: history.error || undefined,
      });
    }
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(frequency: 'hourly' | 'daily' | 'weekly'): Date {
    const now = new Date();

    switch (frequency) {
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +1 week
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
    }
  }

  /**
   * Manually trigger an automation run
   */
  async manualRun(automationId: string): Promise<void> {
    const automation = await Automation.findById(automationId);

    if (!automation) {
      throw new Error('Automation not found');
    }

    await this.runAutomation(automation);
  }
}

export const cronScheduler = new CronScheduler();
