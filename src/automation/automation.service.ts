import { logger } from '../utils/logger';
import { Automation, JobExecution, ExportHistory, IAutomation, IJobExecution, IExportHistory } from '../models/Automation';
import { workflowManager } from './workflow-manager';

export interface AutomationCreateOptions {
  keyword: string;
  location: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  limit?: number;
  category?: string;
}

export interface AutomationUpdateOptions {
  keyword?: string;
  location?: string;
  frequency?: 'hourly' | 'daily' | 'weekly';
  limit?: number;
  category?: string;
  status?: 'active' | 'paused';
}

export class AutomationService {
  /**
   * Create a new automation
   */
  async createAutomation(options: AutomationCreateOptions): Promise<IAutomation> {
    const { keyword, location, frequency, limit = 50, category } = options;

    logger.info(`AutomationService: Creating automation for "${keyword}" in "${location}"`);

    // Validate inputs
    if (!keyword || keyword.trim().length < 2) {
      throw new Error('Keyword must be at least 2 characters');
    }

    if (!location || location.trim().length < 2) {
      throw new Error('Location must be at least 2 characters');
    }

    // Create automation
    const automation = new Automation({
      keyword,
      location,
      frequency,
      limit,
      category,
      status: 'active',
      nextRunAt: new Date(), // Run immediately on creation
    });

    await automation.save();

    logger.info(`AutomationService: Created automation with ID: ${automation.id}`);

    return automation;
  }

  /**
   * Get all automations
   */
  async getAllAutomations(options: {
    page?: number;
    limit?: number;
    status?: 'active' | 'paused' | 'failed';
    keyword?: string;
  } = {}): Promise<{
    automations: IAutomation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10, status, keyword } = options;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (keyword) {
      query.keyword = { $regex: keyword, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [automations, total] = await Promise.all([
      Automation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Automation.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      automations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get automation by ID
   */
  async getAutomationById(id: string): Promise<IAutomation | null> {
    return await Automation.findById(id);
  }

  /**
   * Update automation
   */
  async updateAutomation(id: string, options: AutomationUpdateOptions): Promise<IAutomation | null> {
    const automation = await Automation.findByIdAndUpdate(id, options, { new: true });

    if (!automation) {
      throw new Error('Automation not found');
    }

    logger.info(`AutomationService: Updated automation ${id}`);

    return automation;
  }

  /**
   * Toggle automation status
   */
  async toggleAutomation(id: string): Promise<IAutomation | null> {
    const automation = await Automation.findById(id);

    if (!automation) {
      throw new Error('Automation not found');
    }

    const newStatus = automation.status === 'active' ? 'paused' : 'active';

    const updated = await Automation.findByIdAndUpdate(id, {
      status: newStatus,
    }, { new: true });

    logger.info(`AutomationService: Toggled automation ${id} to ${newStatus}`);

    return updated;
  }

  /**
   * Delete automation
   */
  async deleteAutomation(id: string): Promise<void> {
    await workflowManager.deleteAutomation(id);
  }

  /**
   * Run automation manually
   */
  async runAutomation(id: string): Promise<{
    success: boolean;
    totalLeads: number;
    totalAnalyzed: number;
    totalExtracted: number;
    errors: string[];
  }> {
    const automation = await Automation.findById(id);

    if (!automation) {
      throw new Error('Automation not found');
    }

    return await workflowManager.executeWorkflow(id, {
      keyword: automation.keyword,
      location: automation.location,
      limit: automation.limit,
      category: automation.category,
      triggerType: 'manual',
    });
  }

  /**
   * Get automation logs
   */
  async getAutomationLogs(
    id: string,
    options: {
      page?: number;
      limit?: number;
      jobType?: string;
    } = {}
  ): Promise<{
    logs: IJobExecution[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10, jobType } = options;

    const query: any = { automationId: id };

    if (jobType) {
      query.jobType = jobType;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      JobExecution.find(query)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit),
      JobExecution.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      logs,
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
  async getAutomationStatistics(id: string) {
    return await workflowManager.getStatistics(id);
  }

  /**
   * Get export history for automation
   */
  async getExportHistory(
    id: string,
    options: {
      page?: number;
      limit?: number;
      exportType?: 'csv' | 'excel';
    } = {}
  ): Promise<{
    exports: IExportHistory[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10, exportType } = options;

    const query: any = { automationId: id };

    if (exportType) {
      query.exportType = exportType;
    }

    const skip = (page - 1) * limit;

    const [exports, total] = await Promise.all([
      ExportHistory.find(query)
        .sort({ generatedAt: -1 })
        .skip(skip)
        .limit(limit),
      ExportHistory.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      exports,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}

export const automationService = new AutomationService();
