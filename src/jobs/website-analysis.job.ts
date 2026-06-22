import { logger } from '../utils/logger';
import { websiteAnalyzerService } from '../services/website-analyzer.service';
import { Lead } from '../models/Lead';
import { JobExecution } from '../models/Automation';

export interface WebsiteAnalysisOptions {
  automationId: string;
  leadIds: string[];
}

export class WebsiteAnalysisJob {
  /**
   * Execute website analysis job
   */
  async execute(options: WebsiteAnalysisOptions): Promise<{
    success: boolean;
    analyzedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const { automationId, leadIds } = options;

    logger.info(`WebsiteAnalysisJob: Starting analysis for ${leadIds.length} leads`);

    const jobExecution = await this.createJobExecution(automationId, 'website-analysis', {
      leadIdsCount: leadIds.length,
    });

    let analyzedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const leadId of leadIds) {
      try {
        const lead = await Lead.findById(leadId);

        if (!lead || !lead.website) {
          failedCount++;
          errors.push(`Lead ${leadId}: No website`);
          continue;
        }

        // Analyze website
        const leadAnalysis = await websiteAnalyzerService.analyzeLead(leadId, lead.website);

        // Update lead
        await Lead.findByIdAndUpdate(leadId, {
          websiteStatus: leadAnalysis.websiteStatus,
          leadScore: leadAnalysis.leadScore,
          qualificationLevel: leadAnalysis.qualificationLevel,
          sslEnabled: leadAnalysis.analysisData.sslEnabled,
          responseTime: leadAnalysis.analysisData.responseTime,
          metaTitle: leadAnalysis.analysisData.metaTitle,
          metaDescription: leadAnalysis.analysisData.metaDescription,
          hasContactPage: leadAnalysis.analysisData.hasContactPage,
          hasSocialLinks: leadAnalysis.analysisData.hasSocialLinks,
          analyzedAt: new Date(leadAnalysis.analyzedAt),
        });

        analyzedCount++;

        // Add log
        jobExecution.logs.push(`Analyzed ${lead.companyName}: Score ${leadAnalysis.leadScore}`);

        await jobExecution.save();

      } catch (error: any) {
        logger.warn(`WebsiteAnalysisJob: Failed for lead ${leadId}:`, error.message);
        failedCount++;
        errors.push(error.message);
      }
    }

    // Update job execution
    await this.updateJobExecution(jobExecution.id, {
      status: 'completed',
      totalLeadsGenerated: analyzedCount,
      completedAt: new Date(),
    });

    logger.info(`WebsiteAnalysisJob: Completed - ${analyzedCount} analyzed, ${failedCount} failed`);

    return {
      success: analyzedCount > 0,
      analyzedCount,
      failedCount,
      errors,
    };
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
      logs: [],
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

export const websiteAnalysisJob = new WebsiteAnalysisJob();
