import { logger } from '../utils/logger';
import { Automation, JobExecution } from '../models/Automation';
import { leadGenerationJob } from '../jobs/lead-generation.job';
import { websiteAnalysisJob } from '../jobs/website-analysis.job';
import { contactExtractionJob } from '../jobs/contact-extraction.job';
import { exportGenerationJob } from '../jobs/export-generation.job';
import { Lead } from '../models/Lead';
import { ExportHistory, AutomationHistory, IJobExecution } from '../models/Automation';

export interface AutomationWorkflow {
  id: string;
  keyword: string;
  location: string;
  limit: number;
  category?: string;
}

export class WorkflowManager {
  /**
   * Execute a complete automation workflow
   */
  async executeWorkflow(automationId: string, options: {
    keyword: string;
    location: string;
    limit: number;
    category?: string;
    triggerType: 'manual' | 'api' | 'scheduled';
  }): Promise<{
    success: boolean;
    totalLeads: number;
    totalAnalyzed: number;
    totalExtracted: number;
    errors: string[];
  }> {
    const { keyword, location, limit, category, triggerType } = options;

    logger.info(`WorkflowManager: Starting workflow for "${keyword}" in "${location}"`);

    // Create workflow execution record
    const workflowExecution = await JobExecution.create({
      automationId,
      jobType: 'workflow-execution',
      status: 'running',
      startedAt: new Date(),
      logs: [`Started workflow: ${triggerType}`],
    });

    const errors: string[] = [];
    let totalLeads = 0;
    let totalAnalyzed = 0;
    let totalExtracted = 0;

    try {
      // Step 1: Scrape leads
      const scrapeResult = await leadGenerationJob.execute({
        automationId,
        keyword,
        location,
        limit,
        categoryId: category,
      });

      if (!scrapeResult.success) {
        throw new Error(scrapeResult.errors.length > 0 ? scrapeResult.errors[0] : 'Lead generation failed');
      }

      totalLeads = scrapeResult.leadsGenerated;
      workflowExecution.logs.push(`Scraped ${totalLeads} leads`);
      await workflowExecution.save();

      if (totalLeads === 0) {
        throw new Error('No leads generated');
      }

      // Step 2: Get leads for analysis
      const leads = await Lead.find({
        source: 'google-maps',
        companyName: { $regex: keyword, $options: 'i' },
      }).limit(limit);

      const leadIds = leads.map(l => l.id);

      // Step 3: Analyze websites
      if (leadIds.length > 0) {
        const analysisResult = await websiteAnalysisJob.execute({
          automationId,
          leadIds,
        });

        totalAnalyzed = analysisResult.analyzedCount;
        workflowExecution.logs.push(`Analyzed ${totalAnalyzed} websites`);
        await workflowExecution.save();

        if (analysisResult.failedCount > 0) {
          errors.push(`Failed to analyze ${analysisResult.failedCount} websites`);
        }
      }

      // Step 4: Extract contacts
      if (leadIds.length > 0) {
        const extractionResult = await contactExtractionJob.execute({
          automationId,
          leadIds,
        });

        totalExtracted = extractionResult.extractedCount;
        workflowExecution.logs.push(`Extracted contacts from ${totalExtracted} leads`);
        await workflowExecution.save();

        if (extractionResult.failedCount > 0) {
          errors.push(`Failed to extract from ${extractionResult.failedCount} leads`);
        }
      }

      // Step 5: Generate export
      const filters = {
        search: keyword,
        category,
      };

      await exportGenerationJob.execute({
        automationId,
        exportType: 'excel',
        filters,
      });

      workflowExecution.logs.push('Generated export file');
      workflowExecution.logs.push(`Workflow completed: ${totalLeads} leads, ${totalAnalyzed} analyzed, ${totalExtracted} extracted`);
      await workflowExecution.save();

      // Create history record
      const history = new AutomationHistory({
        automationId,
        triggerType,
        totalLeadsGenerated: totalLeads,
        status: 'success',
        executionTime: 0,
      });

      await history.save();

      logger.info(`WorkflowManager: Workflow completed successfully`);

      return {
        success: true,
        totalLeads,
        totalAnalyzed,
        totalExtracted,
        errors,
      };

    } catch (error: any) {
      logger.error('WorkflowManager: Workflow failed:', error);

      workflowExecution.status = 'failed';
      workflowExecution.error = error.message;
      workflowExecution.completedAt = new Date();
      await workflowExecution.save();

      // Create history record
      const history = new AutomationHistory({
        automationId,
        triggerType,
        totalLeadsGenerated: totalLeads,
        status: 'failed',
        executionTime: 0,
        error: error.message,
      });

      await history.save();

      return {
        success: false,
        totalLeads,
        totalAnalyzed,
        totalExtracted,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Get workflow execution history
   */
  async getExecutionHistory(automationId: string, options: {
    page?: number;
    limit?: number;
  } = {}): Promise<{
    executions: IJobExecution[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10 } = options;

    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      JobExecution.find({ automationId })
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit),
      JobExecution.countDocuments({ automationId }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      executions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get automation statistics
   */
  async getStatistics(automationId: string): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    avgLeadsPerRun: number;
    totalLeadsGenerated: number;
    lastRunAt?: Date;
    nextRunAt?: Date;
  }> {
    const history = await AutomationHistory.aggregate([
      { $match: { automationId: automationId } },
      {
        $group: {
          _id: null,
          totalRuns: { $sum: 1 },
          successfulRuns: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
          },
          failedRuns: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
          avgLeadsPerRun: { $avg: '$totalLeadsGenerated' },
          totalLeadsGenerated: { $sum: '$totalLeadsGenerated' },
        },
      },
    ]);

    const stats = history[0] || {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      avgLeadsPerRun: 0,
      totalLeadsGenerated: 0,
    };

    // Get automation info
    const automation = await Automation.findById(automationId);

    return {
      totalRuns: stats.totalRuns || 0,
      successfulRuns: stats.successfulRuns || 0,
      failedRuns: stats.failedRuns || 0,
      avgLeadsPerRun: Math.round((stats.avgLeadsPerRun || 0) * 100) / 100,
      totalLeadsGenerated: stats.totalLeadsGenerated || 0,
      lastRunAt: automation?.lastRunAt,
      nextRunAt: automation?.nextRunAt,
    };
  }

  /**
   * Pause automation
   */
  async pauseAutomation(automationId: string): Promise<void> {
    await Automation.findByIdAndUpdate(automationId, {
      status: 'paused',
    });

    logger.info(`WorkflowManager: Paused automation ${automationId}`);
  }

  /**
   * Resume automation
   */
  async resumeAutomation(automationId: string): Promise<void> {
    await Automation.findByIdAndUpdate(automationId, {
      status: 'active',
    });

    logger.info(`WorkflowManager: Resumed automation ${automationId}`);
  }

  /**
   * Delete automation
   */
  async deleteAutomation(automationId: string): Promise<void> {
    // Delete automation
    await Automation.findByIdAndDelete(automationId);

    // Delete related executions
    await JobExecution.deleteMany({ automationId });

    // Delete related history
    await AutomationHistory.deleteMany({ automationId });

    // Delete exports
    await ExportHistory.deleteMany({ automationId });

    logger.info(`WorkflowManager: Deleted automation ${automationId}`);
  }
}

export const workflowManager = new WorkflowManager();
