import { logger } from '../utils/logger';
import { ScraperService } from '../services/scraper.service';
import { Automation } from '../models/Automation';
import { JobExecution } from '../models/Automation';

export interface LeadGenerationOptions {
  automationId: string;
  keyword: string;
  location: string;
  limit: number;
  categoryId?: string;
}

export class LeadGenerationJob {
  private scraperService: ScraperService;

  constructor() {
    this.scraperService = new ScraperService();
  }

  /**
   * Execute lead generation job
   */
  async execute(options: LeadGenerationOptions): Promise<{
    success: boolean;
    leadsGenerated: number;
    duplicates: number;
    errors: string[];
  }> {
    const { automationId, keyword, location, limit, categoryId: _categoryId } = options;

    logger.info(`LeadGenerationJob: Starting generation for "${keyword}" in "${location}"`);

    const jobExecution = await this.createJobExecution(automationId, 'lead-generation', {
      keyword,
      location,
      limit,
    });

    try {
      const result = await this.scraperService.scrapeBusinesses({
        keyword,
        location,
        limit,
      });

      // Update job execution
      await this.updateJobExecution(jobExecution.id, {
        status: 'completed',
        totalLeadsGenerated: result.totalStored,
        completedAt: new Date(),
      });

      // Update automation run stats
      await Automation.findByIdAndUpdate(automationId, {
        $inc: { totalRuns: 1, lastRunLeads: result.totalStored },
        lastRunStatus: result.totalStored > 0 ? 'success' : 'partial',
        lastRunAt: new Date(),
      });

      logger.info(`LeadGenerationJob: Completed - ${result.totalStored} leads generated`);

      return {
        success: result.totalStored > 0,
        leadsGenerated: result.totalStored,
        duplicates: result.totalDuplicates,
        errors: [],
      };
    } catch (error: any) {
      logger.error('LeadGenerationJob: Failed:', error);

      // Update job execution
      await this.updateJobExecution(jobExecution.id, {
        status: 'failed',
        failedCount: 1,
        error: error.message,
        completedAt: new Date(),
      });

      // Update automation status
      await Automation.findByIdAndUpdate(automationId, {
        status: 'failed',
        error: error.message,
        lastRunStatus: 'failed',
        lastRunAt: new Date(),
      });

      return {
        success: false,
        leadsGenerated: 0,
        duplicates: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Create job execution record
   */
  private async createJobExecution(
    automationId: string,
    jobType: string,
    metadata: any
  ): Promise<any> {
    const jobExecution = new JobExecution({
      automationId,
      jobType,
      status: 'running',
      startedAt: new Date(),
      metadata,
    });

    return await jobExecution.save();
  }

  /**
   * Update job execution record
   */
  private async updateJobExecution(jobExecutionId: string, updates: any): Promise<void> {
    await JobExecution.findByIdAndUpdate(jobExecutionId, updates);
  }
}

export const leadGenerationJob = new LeadGenerationJob();
