import { logger } from '../utils/logger';
import { ExportHistory } from '../models/Automation';
import { excelExporter, csvExporter } from '../exporters';
import { JobExecution } from '../models/Automation';

export interface ExportGenerationOptions {
  automationId: string;
  exportType: 'csv' | 'excel';
  filters: any;
}

export class ExportGenerationJob {
  /**
   * Execute export generation job
   */
  async execute(options: ExportGenerationOptions): Promise<{
    success: boolean;
    exportPath: string;
    fileName: string;
    totalRecords: number;
    errors: string[];
  }> {
    const { automationId, exportType, filters } = options;

    logger.info(`ExportGenerationJob: Starting ${exportType} export`);

    const jobExecution = await this.createJobExecution(automationId, 'export-generation', {
      exportType,
      filters,
    });

    try {
      let result;
      let exportPath;
      let fileName;

      if (exportType === 'csv') {
        result = await csvExporter.exportToCSV({
          ...filters,
          filename: `automation_export_${Date.now()}`,
          filePath: './exports',
        });
        exportPath = result.filepath;
        fileName = `automation_export_${Date.now()}.csv`;
      } else {
        result = await excelExporter.exportWithFormatting({
          ...filters,
          filename: `automation_export_${Date.now()}`,
          filePath: './exports',
        });
        exportPath = result.filepath;
        fileName = `automation_export_${Date.now()}.xlsx`;
      }

      // Update job execution
      await this.updateJobExecution(jobExecution.id, {
        status: 'completed',
        totalLeadsGenerated: result.rowCount,
        metadata: {
          exportPath,
          fileName,
        },
        completedAt: new Date(),
      });

      // Create export history record
      const exportHistory = new ExportHistory({
        automationId,
        exportType,
        filePath: exportPath,
        fileName,
        generatedAt: new Date(),
        totalRecords: result.rowCount,
      });

      await exportHistory.save();

      logger.info(`ExportGenerationJob: Completed - ${exportPath} generated`);

      return {
        success: true,
        exportPath,
        fileName,
        totalRecords: result.rowCount,
        errors: [],
      };
    } catch (error: any) {
      logger.error('ExportGenerationJob: Failed:', error);

      // Update job execution
      await this.updateJobExecution(jobExecution.id, {
        status: 'failed',
        failedCount: 1,
        error: error.message,
        completedAt: new Date(),
      });

      return {
        success: false,
        exportPath: '',
        fileName: '',
        totalRecords: 0,
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

export const exportGenerationJob = new ExportGenerationJob();
