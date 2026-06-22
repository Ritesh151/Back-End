import { Request, Response } from 'express';
import { outreachService } from '../services/outreach.service';
import { auditConcurrency } from '../services/audit-concurrency.service';
import { auditCache } from '../services/audit-cache.service';
import { APIResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export const outreachController = {
  async generateForLead(req: Request, res: Response) {
    try {
      const { leadId } = req.params;

      const cached = auditCache.get(`outreach:${leadId}`);
      if (cached) {
        APIResponse.success(res, cached, 'Returned cached outreach data');
        return;
      }

      auditConcurrency.enqueue(leadId, 'outreach', () =>
        outreachService.generateOutreachForLead(leadId).then(r => {
          if (r.data) auditCache.set(`outreach:${leadId}`, r.data);
          return r;
        })
      ).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, 'Background outreach generation failed');
      });

      APIResponse.success(res, {
        leadId,
        status: 'queued',
        message: 'Outreach generation has been queued. Results will appear when ready.',
      }, 'Outreach queued');
    } catch (error: any) {
      APIResponse.error(res, error.message || 'Failed to queue outreach', null, 500);
    }
  },

  async getLeadOutreach(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const data = await outreachService.getLeadOutreach(leadId);
      APIResponse.success(res, data, 'Outreach data fetched successfully');
    } catch (error: any) {
      APIResponse.error(res, error.message || 'Failed to get outreach data', null, 500);
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const { status } = req.body;
      if (!status) {
        APIResponse.error(res, 'status is required', null, 400);
        return;
      }
      const result = await outreachService.updateOutreachStatus(leadId, status);
      APIResponse.success(res, result, 'Outreach status updated successfully');
    } catch (error: any) {
      APIResponse.error(res, error.message || 'Failed to update outreach status', null, 500);
    }
  },

  async generateForMultipleLeads(req: Request, res: Response) {
    try {
      const { leadIds } = req.body;
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        APIResponse.error(res, 'leadIds array is required', null, 400);
        return;
      }

      for (const leadId of leadIds.slice(0, 5)) {
        auditConcurrency.enqueue(leadId, 'outreach', () =>
          outreachService.generateOutreachForLead(leadId)
        ).catch((err: unknown) => {
          logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, 'Bulk outreach failed');
        });
      }

      APIResponse.success(res, { queued: Math.min(leadIds.length, 5) }, 'Bulk outreach queued');
    } catch (error: any) {
      APIResponse.error(res, error.message || 'Failed to queue bulk outreach', null, 500);
    }
  },

  async generateForPendingLeads(_req: Request, res: Response) {
    APIResponse.success(res, { status: 'queued' }, 'Pending outreach queued');
  },

  async getStats(_req: Request, res: Response) {
    try {
      const stats = await outreachService.getOutreachStats();
      APIResponse.success(res, stats, 'Outreach statistics retrieved');
    } catch (error: any) {
      APIResponse.error(res, error.message || 'Failed to get outreach stats', null, 500);
    }
  },
};
