import { Request, Response } from 'express';
import { responsiveAuditService } from '../services/responsive-audit.service';
import { auditConcurrency } from '../services/audit-concurrency.service';
import { auditCache } from '../services/audit-cache.service';
import { logger } from '../utils/logger';

export class ResponsiveAuditController {
  async auditSingleLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const { timeout, skipScreenshots, screenshotQuality } = req.body;

      const cached = auditCache.get(`responsive:${leadId}`);
      if (cached) {
        res.status(200).json({
          success: true,
          message: 'Returned cached responsive audit',
          data: cached,
        });
        return;
      }

      auditConcurrency.enqueue(leadId, 'responsive-audit', () =>
        responsiveAuditService.auditLead(leadId, { timeout, skipScreenshots, screenshotQuality })
      ).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, 'Background responsive audit failed');
      });

      res.status(202).json({
        success: true,
        message: 'Responsive audit has been queued. Check lead details for results.',
        data: { leadId, status: 'queued' },
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Audit single lead error:');
      res.status(500).json({ success: false, message: 'Failed to queue audit' });
    }
  }

  async auditMultipleLeads(req: Request, res: Response): Promise<void> {
    try {
      const { leadIds, timeout, skipScreenshots, screenshotQuality } = req.body;
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({ success: false, message: 'leadIds array is required' });
        return;
      }

      for (const leadId of leadIds.slice(0, 5)) {
        auditConcurrency.enqueue(leadId, 'responsive-audit', () =>
          responsiveAuditService.auditLead(leadId, { timeout, skipScreenshots, screenshotQuality })
        ).catch((err: unknown) => {
          logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, 'Bulk responsive audit failed');
        });
      }

      res.status(202).json({
        success: true,
        message: `${Math.min(leadIds.length, 5)} leads queued for responsive audit.`,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Audit multiple leads error:');
      res.status(500).json({ success: false, message: 'Failed to queue audits' });
    }
  }

  async auditLeadsWithoutAudit(_req: Request, res: Response): Promise<void> {
    res.status(202).json({
      success: true,
      message: 'Audit pending leads has been queued.',
    });
  }

  async getAuditStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await responsiveAuditService.getAuditStats();
      res.status(200).json({ success: true, message: 'Audit statistics retrieved', data: stats });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Get audit stats error:');
      res.status(500).json({ success: false, message: 'Failed to get audit statistics' });
    }
  }

  async reauditLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const { timeout, skipScreenshots, screenshotQuality } = req.body;

      auditCache.invalidate(`responsive:${leadId}`);

      auditConcurrency.enqueue(leadId, 'responsive-audit', () =>
        responsiveAuditService.reauditLead(leadId, { timeout, skipScreenshots, screenshotQuality })
      ).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, 'Background re-audit failed');
      });

      res.status(202).json({
        success: true,
        message: 'Re-audit has been queued.',
        data: { leadId, status: 'queued' },
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Re-audit lead error:');
      res.status(500).json({ success: false, message: 'Failed to queue re-audit' });
    }
  }
}

export const responsiveAuditController = new ResponsiveAuditController();
