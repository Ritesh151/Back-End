import { Request, Response, NextFunction } from 'express'
import { websiteIntelligenceService } from '../services/website-intelligence.service'
import { auditConcurrency } from '../services/audit-concurrency.service'
import { auditCache } from '../services/audit-cache.service'
import { APIResponse } from '../utils/api-response'

export class WebsiteIntelligenceController {
  async analyzeSingleLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params
      const forceRefresh = req.body?.forceRefresh

      if (!forceRefresh) {
        const cached = auditCache.get(`website-intel:${leadId}`)
        if (cached) {
          APIResponse.success(res, cached, 'Returned cached website intelligence')
          return
        }
      }

      if (forceRefresh) {
        auditCache.invalidate(`website-intel:${leadId}`)
      }

      auditConcurrency.enqueue(leadId, 'website-intelligence', () =>
        websiteIntelligenceService.analyzeLead(leadId, { forceRefresh })
      ).catch(() => {})

      APIResponse.success(res, {
        leadId,
        status: 'queued',
        message: 'Website intelligence analysis has been queued. Check lead details for results.',
      }, 'Analysis queued')
    } catch (error) {
      next(error)
    }
  }

  async reanalyzeLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params
      auditCache.invalidate(`website-intel:${leadId}`)

      auditConcurrency.enqueue(leadId, 'website-intelligence', () =>
        websiteIntelligenceService.reanalyzeLead(leadId)
      ).catch(() => {})

      APIResponse.success(res, { leadId, status: 'queued' }, 'Re-analysis queued')
    } catch (error) {
      next(error)
    }
  }

  async getIntelligenceStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await websiteIntelligenceService.getIntelligenceStats()
      APIResponse.success(res, stats, 'Intelligence stats retrieved')
    } catch (error) {
      next(error)
    }
  }

  async analyzeMultipleLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadIds } = req.body as { leadIds: string[] }
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        APIResponse.error(res, 'leadIds array is required', undefined, 400)
        return
      }

      for (const leadId of leadIds.slice(0, 5)) {
        auditConcurrency.enqueue(leadId, 'website-intelligence', () =>
          websiteIntelligenceService.analyzeLead(leadId)
        ).catch(() => {})
      }

      APIResponse.success(res, { queued: Math.min(leadIds.length, 5) }, 'Analysis queued')
    } catch (error) {
      next(error)
    }
  }
}

export const websiteIntelligenceController = new WebsiteIntelligenceController();
