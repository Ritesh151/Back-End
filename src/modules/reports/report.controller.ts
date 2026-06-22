import type { Request, Response, NextFunction } from 'express';
import { Lead } from '../../models/Lead';
import { reportService } from './report.service';
import { reportQueue } from './report.queue';
import { logger } from '../../utils/logger';
import { APIResponse } from '../../utils/api-response';

export class ReportController {
  async generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        APIResponse.error(res, 'Lead ID is required', null, 400);
        return;
      }

      const lead = await Lead.findById(leadId).select('_id companyName').lean();
      if (!lead) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      reportQueue.enqueue(leadId).then((result) => {
        logger.info({ leadId, result }, '[ReportController] Report generation completed');
      }).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, '[ReportController] Report generation failed');
      });

      APIResponse.success(res, {
        leadId,
        status: 'queued',
        message: 'Report generation has been queued. Check status via GET /reports/status/:leadId',
      }, 'Report generation started');
    } catch (error) {
      next(error);
    }
  }

  async getReportStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        APIResponse.error(res, 'Lead ID is required', null, 400);
        return;
      }

      const status = await reportService.getReportStatus(leadId);

      if (!status.exists) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      APIResponse.success(res, {
        leadId,
        report: status.report,
        isQueued: reportQueue.isQueued(leadId),
      }, 'Report status fetched');
    } catch (error) {
      next(error);
    }
  }

  async viewReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        APIResponse.error(res, 'Lead ID is required', null, 400);
        return;
      }

      const data = await reportService.getReportData(leadId);

      if (!data.html) {
        APIResponse.error(res, 'Report not found or not yet generated', null, 404);
        return;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(data.html);
    } catch (error) {
      next(error);
    }
  }

  async downloadReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        APIResponse.error(res, 'Lead ID is required', null, 400);
        return;
      }

      const data = await reportService.getReportData(leadId);

      if (!data.pdf) {
        APIResponse.error(res, 'PDF report not found or not yet generated', null, 404);
        return;
      }

      const leadDoc = await Lead.findById(leadId).select('companyName').lean() as { companyName?: string } | null;
      const companyName = leadDoc?.companyName || leadId;
      const filename = `audit_report_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data.pdf);
    } catch (error) {
      next(error);
    }
  }

  async deleteReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        APIResponse.error(res, 'Lead ID is required', null, 400);
        return;
      }

      const deleted = await reportService.deleteReport(leadId);

      if (!deleted) {
        APIResponse.error(res, 'Report not found', null, 404);
        return;
      }

      APIResponse.success(res, null, 'Report deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getReportProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        APIResponse.error(res, 'Lead ID is required', null, 400);
        return;
      }

      const status = await reportService.getReportStatus(leadId);

      if (!status.exists) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      APIResponse.success(res, {
        leadId,
        progress: status.report?.progress || null,
        generating: status.report?.generating || false,
        generated: status.report?.generated || false,
        isQueued: reportQueue.isQueued(leadId),
      }, 'Report progress fetched');
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
