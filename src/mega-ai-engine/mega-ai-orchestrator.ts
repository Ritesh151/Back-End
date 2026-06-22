import { logger } from '../utils/logger';
import { responsiveAuditService } from '../services/responsive-audit.service';
import { businessIntelligenceService } from '../services/business-intelligence.service';
import { salesIntelligenceService } from '../services/sales-intelligence.service';
import { outreachService } from '../services/outreach.service';
import { Lead } from '../models/Lead';

export interface MegaPipelineResult {
  leadId: string;
  companyName: string;
  responsiveAudit: boolean;
  businessIntelligence: boolean;
  salesIntelligence: boolean;
  outreach: boolean;
  crmUpdate: boolean;
  errors: string[];
  duration: number;
}

export class MegaAIOrchestrator {
  async runFullPipeline(leadId: string): Promise<MegaPipelineResult> {
    const start = Date.now();
    const errors: string[] = [];
    const result: MegaPipelineResult = {
      leadId,
      companyName: '',
      responsiveAudit: false,
      businessIntelligence: false,
      salesIntelligence: false,
      outreach: false,
      crmUpdate: false,
      errors,
      duration: 0,
    };

    try {
      const lead = await Lead.findById(leadId).lean();
      if (!lead) {
        throw new Error('Lead not found');
      }
      result.companyName = (lead as any).companyName || 'Unknown';

      if (!(lead as any).website) {
        throw new Error('Lead has no website');
      }

      logger.info(`MEGA AI: Starting full pipeline for lead ${leadId} (${result.companyName})`);

      // Phase 13 — Responsive & UI/UX Audit
      try {
        logger.info(`MEGA AI: Phase 13 - Responsive audit for ${leadId}`);
        await responsiveAuditService.auditLead(leadId);
        result.responsiveAudit = true;
        logger.info(`MEGA AI: Phase 13 completed for ${leadId}`);
      } catch (err: any) {
        errors.push(`Phase 13 (Responsive): ${err.message}`);
        logger.error(err, `MEGA AI Phase 13 failed for ${leadId}:`);
      }

      // Phase 14 — Business Intelligence
      try {
        logger.info(`MEGA AI: Phase 14 - Business intelligence for ${leadId}`);
        await businessIntelligenceService.analyzeLead(leadId);
        result.businessIntelligence = true;
        logger.info(`MEGA AI: Phase 14 completed for ${leadId}`);
      } catch (err: any) {
        errors.push(`Phase 14 (Business Intel): ${err.message}`);
        logger.error(err, `MEGA AI Phase 14 failed for ${leadId}:`);
      }

      // Phase 15 — Sales Intelligence
      try {
        logger.info(`MEGA AI: Phase 15 - Sales intelligence for ${leadId}`);
        await salesIntelligenceService.analyzeLead(leadId);
        result.salesIntelligence = true;
        logger.info(`MEGA AI: Phase 15 completed for ${leadId}`);
      } catch (err: any) {
        errors.push(`Phase 15 (Sales Intel): ${err.message}`);
        logger.error(err, `MEGA AI Phase 15 failed for ${leadId}:`);
      }

      // Phase 16 — Outreach Generation
      try {
        logger.info(`MEGA AI: Phase 16 - Outreach generation for ${leadId}`);
        await outreachService.generateOutreachForLead(leadId);
        result.outreach = true;
        logger.info(`MEGA AI: Phase 16 completed for ${leadId}`);
      } catch (err: any) {
        errors.push(`Phase 16 (Outreach): ${err.message}`);
        logger.error(err, `MEGA AI Phase 16 failed for ${leadId}:`);
      }

      // CRM Update
      try {
        logger.info(`MEGA AI: Updating CRM status for ${leadId}`);
        await Lead.findByIdAndUpdate(leadId, {
          $set: {
            crmOutreachStatus: 'outreach_pending',
          },
        });
        result.crmUpdate = true;
      } catch (err: any) {
        errors.push(`CRM Update: ${err.message}`);
        logger.error(err, `MEGA AI CRM update failed for ${leadId}:`);
      }

      result.duration = Date.now() - start;
      logger.info(`MEGA AI: Full pipeline completed for ${leadId} in ${result.duration}ms. Errors: ${errors.length}`);
      return result;
    } catch (err: any) {
      errors.push(err.message);
      result.duration = Date.now() - start;
      logger.error(err, `MEGA AI pipeline failed for ${leadId}:`);
      return result;
    }
  }

  async runFullPipelineForMultiple(leadIds: string[]): Promise<{
    results: MegaPipelineResult[];
    successful: number;
    failed: number;
    total: number;
    totalDuration: number;
  }> {
    const overallStart = Date.now();
    const results: MegaPipelineResult[] = [];

    for (const leadId of leadIds) {
      try {
        const r = await this.runFullPipeline(leadId);
        results.push(r);
      } catch (err: any) {
        results.push({
          leadId,
          companyName: '',
          responsiveAudit: false,
          businessIntelligence: false,
          salesIntelligence: false,
          outreach: false,
          crmUpdate: false,
          errors: [err.message],
          duration: 0,
        });
      }
    }

    const successful = results.filter(r => r.errors.length === 0).length;
    const failed = results.filter(r => r.errors.length > 0).length;

    logger.info(`MEGA AI: Batch complete - ${successful} successful, ${failed} failed out of ${leadIds.length} in ${Date.now() - overallStart}ms`);

    return {
      results,
      successful,
      failed,
      total: leadIds.length,
      totalDuration: Date.now() - overallStart,
    };
  }

  async runFullPipelineForPendingLeads(limit = 10): Promise<{
    results: MegaPipelineResult[];
    successful: number;
    failed: number;
    total: number;
  }> {
    const leads = await Lead.find({
      website: { $exists: true, $nin: [null, ''] },
      $or: [
        { responsiveAuditCompleted: { $ne: true } },
        { responsiveAuditCompleted: { $exists: false } },
      ],
    })
      .limit(limit)
      .lean();

    if (leads.length === 0) {
      return { results: [], successful: 0, failed: 0, total: 0 };
    }

    const leadIds = leads.map(l => (l as any)._id.toString());
    return this.runFullPipelineForMultiple(leadIds);
  }

  async getPipelineStats(): Promise<{
    totalLeads: number;
    withWebsite: number;
    responsiveCompleted: number;
    intelligenceCompleted: number;
    salesCompleted: number;
    outreachCompleted: number;
    fullPipelineCompleted: number;
    pendingFullPipeline: number;
  }> {
    const [
      totalLeads,
      withWebsite,
      responsiveCompleted,
      intelligenceCompleted,
      salesCompleted,
      outreachCompleted,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ website: { $exists: true, $nin: [null, ''] } }),
      Lead.countDocuments({ responsiveAuditCompleted: true }),
      Lead.countDocuments({ intelligenceCompleted: true }),
      Lead.countDocuments({ salesIntelligenceCompleted: true }),
      Lead.countDocuments({ outreachCompleted: true }),
    ]);

    const fullPipelineCompleted = await Lead.countDocuments({
      responsiveAuditCompleted: true,
      intelligenceCompleted: true,
      salesIntelligenceCompleted: true,
      outreachCompleted: true,
    });

    return {
      totalLeads,
      withWebsite,
      responsiveCompleted,
      intelligenceCompleted,
      salesCompleted,
      outreachCompleted,
      fullPipelineCompleted,
      pendingFullPipeline: totalLeads - fullPipelineCompleted,
    };
  }
}

export const megaAIOrchestrator = new MegaAIOrchestrator();
