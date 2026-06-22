import type { Request, Response } from 'express';
import { megaAIOrchestrator } from '../mega-ai-engine/mega-ai-orchestrator';
import { aiProcessingQueue } from '../services/ai-processing-queue.service';
import { Lead } from '../models/Lead';
import { APIResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { websiteAnalysisService } from '../services/website-analysis.service';

export const megaAIController = {
  analyzeLead(req: Request, res: Response): void {
    try {
      const { leadId } = req.params;

      aiProcessingQueue.enqueueLead(leadId).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, 'MEGA AI background pipeline failed');
      });

      APIResponse.success(res, {
        leadId,
        status: 'queued',
        message: 'Full AI pipeline has been queued. Results will be available shortly.',
      }, 'Pipeline queued');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Pipeline queue failed';
      APIResponse.error(res, msg, null, 500);
    }
  },

  analyzeMultipleLeads(req: Request, res: Response): void {
    try {
      const { leadIds } = req.body as { leadIds?: string[] };
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        APIResponse.error(res, 'leadIds array is required', null, 400);
        return;
      }

      aiProcessingQueue.enqueueMultiple(leadIds);

      APIResponse.success(res, {
        queued: leadIds.length,
        status: 'queued',
        message: `${leadIds.length} leads queued for full pipeline analysis.`,
      }, 'Batch pipeline queued');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Batch pipeline queue failed';
      APIResponse.error(res, msg, null, 500);
    }
  },

  async analyzePendingLeads(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as { limit?: number };
      const limit = body.limit || 50;
      const count = await aiProcessingQueue.enqueueAllPendingLeads(limit);
      APIResponse.success(res, {
        enqueued: count,
        status: 'queued',
        message: `${count} pending leads queued for analysis.`,
      }, 'Pending analysis queued');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to queue pending analysis';
      APIResponse.error(res, msg, null, 500);
    }
  },

  async getPipelineStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await megaAIOrchestrator.getPipelineStats();
      APIResponse.success(res, stats, 'Pipeline stats retrieved');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to get stats';
      APIResponse.error(res, msg, null, 500);
    }
  },

  async getLeadAIStatus(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const lead = await Lead.findById(leadId).select(
        'aiStatus aiProgress aiCurrentStep aiCurrentStepIndex aiTotalSteps aiError ' +
        'processingStartedAt processingCompletedAt lastAuditAt reportGenerated ' +
        'responsiveAuditReady intelligenceReady outreachReady salesAIReady reportReady ' +
        'responsiveAuditCompleted intelligenceCompleted salesIntelligenceCompleted outreachCompleted ' +
        'aiWebsiteHash website'
      ).lean();

      if (!lead) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      const queueStatus = aiProcessingQueue.getStatus();
      const leadRecord = lead as Record<string, unknown>;
      const leadIdStr = String(leadRecord._id);

      APIResponse.success(res, {
        id: leadIdStr,
        aiStatus: leadRecord.aiStatus,
        aiProgress: leadRecord.aiProgress,
        aiCurrentStep: leadRecord.aiCurrentStep,
        aiCurrentStepIndex: leadRecord.aiCurrentStepIndex,
        aiTotalSteps: leadRecord.aiTotalSteps,
        aiError: leadRecord.aiError,
        processingStartedAt: leadRecord.processingStartedAt,
        processingCompletedAt: leadRecord.processingCompletedAt,
        lastAuditAt: leadRecord.lastAuditAt,
        reportGenerated: leadRecord.reportGenerated,
        responsiveAuditReady: leadRecord.responsiveAuditReady,
        intelligenceReady: leadRecord.intelligenceReady,
        outreachReady: leadRecord.outreachReady,
        salesAIReady: leadRecord.salesAIReady,
        reportReady: leadRecord.reportReady,
        responsiveAuditCompleted: leadRecord.responsiveAuditCompleted,
        intelligenceCompleted: leadRecord.intelligenceCompleted,
        salesIntelligenceCompleted: leadRecord.salesIntelligenceCompleted,
        outreachCompleted: leadRecord.outreachCompleted,
        aiWebsiteHash: leadRecord.aiWebsiteHash,
        website: leadRecord.website,
        queueStatus,
      }, 'AI status retrieved');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to get AI status';
      APIResponse.error(res, msg, null, 500);
    }
  },

  async refreshAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;

      const lead = await Lead.findById(leadId).select('aiStatus website').lean();
      if (!lead) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      const leadRecord = lead as Record<string, unknown>;
      const aiStatus = leadRecord.aiStatus as string;
      if (aiStatus === 'processing' || aiStatus === 'queued') {
        APIResponse.error(res, 'Analysis is already running for this lead', null, 409);
        return;
      }

      const website = leadRecord.website as string | undefined;
      const analysis = websiteAnalysisService.analyze(website);
      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          analysisEligible: analysis.analysisEligible,
          normalizedDomain: analysis.normalizedDomain,
          hasWebsite: analysis.hasWebsite,
          hasRealWebsite: analysis.analysisEligible,
        },
      });

      if (!analysis.analysisEligible) {
        logger.info(`[MegaAIController] Refresh skipped for lead ${leadId} — analysisEligible is false`);
        APIResponse.success(res, {
          leadId,
          status: 'skipped',
          message: 'Lead has no standalone website — analysis not applicable.',
        }, 'Refresh skipped');
        return;
      }

      aiProcessingQueue.enqueueLead(leadId).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, 'Refresh analysis enqueue failed');
      });

      APIResponse.success(res, {
        leadId,
        status: 'queued',
        message: 'Analysis refresh has been queued.',
      }, 'Analysis refresh queued');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to queue refresh';
      APIResponse.error(res, msg, null, 500);
    }
  },
};
