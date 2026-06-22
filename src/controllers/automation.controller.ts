import { Request, Response, NextFunction } from 'express';
import { automationService } from '../automation/automation.service';
import { APIResponse } from '../utils/api-response';

export class AutomationController {
  /**
   * Create a new automation
   */
  async createAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { keyword, location, frequency, limit, category } = req.body;

      if (!keyword || !location || !frequency) {
        APIResponse.error(res, 'keyword, location, and frequency are required', null, 400);
        return;
      }

      const automation = await automationService.createAutomation({
        keyword,
        location,
        frequency,
        limit: limit || 50,
        category,
      });

      APIResponse.success(res, automation, 'Automation created successfully', 201);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all automations
   */
  async getAllAutomations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page?.toString() || '1', 10);
      const limit = parseInt(req.query.limit?.toString() || '10', 10);
      const status = req.query.status?.toString();
      const keyword = req.query.keyword?.toString();

      const result = await automationService.getAllAutomations({
        page,
        limit,
        status: status as any,
        keyword,
      });

      APIResponse.success(res, result, 'Automations fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get automation by ID
   */
  async getAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const automation = await automationService.getAutomationById(req.params.id);

      if (!automation) {
        APIResponse.error(res, 'Automation not found', null, 404);
        return;
      }

      APIResponse.success(res, automation, 'Automation fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update automation
   */
  async updateAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const automation = await automationService.updateAutomation(req.params.id, req.body);

      APIResponse.success(res, automation, 'Automation updated successfully');
    } catch (error: any) {
      APIResponse.error(res, error.message, null, 404);
    }
  }

  /**
   * Toggle automation status
   */
  async toggleAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const automation = await automationService.toggleAutomation(req.params.id);

      APIResponse.success(res, automation, 'Automation status toggled');
    } catch (error: any) {
      APIResponse.error(res, error.message, null, 404);
    }
  }

  /**
   * Delete automation
   */
  async deleteAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await automationService.deleteAutomation(req.params.id);

      APIResponse.success(res, null, 'Automation deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Run automation manually
   */
  async runAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await automationService.runAutomation(req.params.id);

      if (result.success) {
        APIResponse.success(res, result, 'Automation run completed');
      } else {
        APIResponse.error(res, 'Automation run failed', result.errors, 400);
      }
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get automation logs
   */
  async getAutomationLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page?.toString() || '1', 10);
      const limit = parseInt(req.query.limit?.toString() || '10', 10);
      const jobType = req.query.jobType?.toString();

      const result = await automationService.getAutomationLogs(req.params.id, {
        page,
        limit,
        jobType: jobType as any,
      });

      APIResponse.success(res, result, 'Automation logs fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get automation statistics
   */
  async getAutomationStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await automationService.getAutomationStatistics(req.params.id);

      APIResponse.success(res, stats, 'Automation statistics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get export history
   */
  async getExportHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page?.toString() || '1', 10);
      const limit = parseInt(req.query.limit?.toString() || '10', 10);
      const exportType = req.query.exportType?.toString() as 'csv' | 'excel' | undefined;

      const result = await automationService.getExportHistory(req.params.id, {
        page,
        limit,
        exportType,
      });

      APIResponse.success(res, result, 'Export history fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const automationController = new AutomationController();
