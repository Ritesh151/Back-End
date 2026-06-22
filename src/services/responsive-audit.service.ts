import { Lead, ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import { responsiveEngine } from '../uiux-intelligence';
import { websiteAnalysisService } from './website-analysis.service';
import { auditCache } from './audit-cache.service';
import { withTimeout } from '../utils/audit-timeout';
import { profiler } from './performance-profiler.service';
import pLimit from 'p-limit';

interface ResponsiveAuditOptions {
  timeout?: number;
  skipScreenshots?: boolean;
  screenshotQuality?: number;
}

interface BulkAuditResult {
  success: boolean;
  message: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  results: Array<{
    leadId: string;
    success: boolean;
    error?: string;
  }>;
}

export class ResponsiveAuditService {
  private readonly maxConcurrent = 3;
  private readonly limit = pLimit(this.maxConcurrent);

  async auditLead(leadId: string, options: ResponsiveAuditOptions = {}): Promise<ILead | null> {
    profiler.start(`responsive-audit:${leadId}`, { leadId });
    const startTime = Date.now();
    try {
      logger.info(`[ResponsiveAuditService] Starting audit for lead ${leadId}`);
      
      const lead = await Lead.findById(leadId);
      
      if (!lead) {
        logger.warn(`[ResponsiveAuditService] Lead not found: ${leadId}`);
        return null;
      }

      if (!lead.hasWebsite || !lead.website) {
        logger.warn(`[ResponsiveAuditService] Lead ${leadId} has no website`);
        return lead;
      }

      const analysis = websiteAnalysisService.resolveLead(lead);

      if (!analysis.analysisEligible) {
        logger.warn(`[ResponsiveAuditService] Lead ${leadId} is not analysis-eligible (websiteType=${lead.websiteType}) — skipping audit`);
        logger.info('[ResponsiveAudit] Responsive Audit Skipped — analysisEligible is false');
        return lead;
      }

      logger.info('[ResponsiveAudit] Responsive Audit Started');
      logger.info('[ResponsiveAudit] SEO Started');
      logger.info('[ResponsiveAudit] UI/UX Audit Started');

      if (lead.responsiveAuditCompleted && !options.timeout) {
        const cacheKey = `responsive:${leadId}`;
        const cached = auditCache.getByWebsiteHash<ILead>(cacheKey, lead.website);
        if (cached.isCached) {
          logger.info(`[ResponsiveAuditService] Returning cached audit for lead ${leadId}`);
          return cached.data;
        }
      }

      logger.info(`[ResponsiveAuditService] Website to audit: ${lead.website}`);
      logger.info(`[ResponsiveAuditService] Starting responsive audit for lead ${leadId}`);

      let auditResult;
      try {
        const engineStartTime = Date.now();
        auditResult = await withTimeout(responsiveEngine.analyzeWebsite(lead.website, options), 90000, `ResponsiveEngine.analyzeWebsite(${leadId})`);
        const engineDuration = Date.now() - engineStartTime;
        logger.info(`[ResponsiveAuditService] ✅ Engine returned results in ${engineDuration}ms: completed=${auditResult.responsiveAuditCompleted}, responsive=${auditResult.scores.responsiveScore}, uiux=${auditResult.scores.uiuxScore}, mobile=${auditResult.scores.mobileExperienceScore}`);
      } catch (engineError) {
        logger.error(engineError instanceof Error ? engineError : new Error(String(engineError)), `[ResponsiveAuditService] ❌ Engine crashed for ${lead.website}`);
        throw engineError;
      }

      if (!auditResult.responsiveAuditCompleted) {
        logger.warn(`[ResponsiveAuditService] ⚠️  Audit did not complete successfully for lead ${leadId}`);
        lead.responsiveAuditCompleted = false;
        lead.responsiveScore = auditResult.scores.responsiveScore || 0;
        lead.uiuxScore = auditResult.scores.uiuxScore || 0;
        lead.mobileExperienceScore = auditResult.scores.mobileExperienceScore || 0;
        lead.responsiveAudit = {
          mobileFriendly: auditResult.responsiveAudit.mobileFriendly,
          responsiveLayout: auditResult.responsiveAudit.responsiveLayout,
          horizontalScroll: auditResult.responsiveAudit.horizontalScroll,
          overflowIssues: auditResult.responsiveAudit.overflowIssues,
          viewportMeta: auditResult.responsiveAudit.viewportMeta,
          viewportContent: auditResult.responsiveAudit.viewportContent || undefined,
          touchFriendly: auditResult.responsiveAudit.touchFriendly,
          fontSizeIssues: auditResult.responsiveAudit.fontSizeIssues,
        };
        lead.uiuxAudit = {
          alignmentIssues: auditResult.uiuxAudit.alignmentIssues,
          brokenButtons: auditResult.uiuxAudit.brokenButtons,
          croppedSections: auditResult.uiuxAudit.croppedSections,
          mobileLayoutBroken: auditResult.uiuxAudit.mobileLayoutBroken,
          overlappingContent: auditResult.uiuxAudit.overlappingContent,
          hiddenContent: auditResult.uiuxAudit.hiddenContent,
          navigationIssues: auditResult.uiuxAudit.navigationIssues,
          spacingIssues: auditResult.uiuxAudit.spacingIssues,
          issues: auditResult.uiuxAudit.issues,
        };
        lead.responsiveAuditedAt = auditResult.auditedAt;
        await lead.save();
        logger.info(`[ResponsiveAuditService] ⚠️  Incomplete audit saved with default scores for lead ${leadId}`);
        return lead;
      }

      logger.info(`[ResponsiveAuditService] 📊 Mapping audit results for lead ${leadId}`);

      lead.responsiveAudit = {
        mobileFriendly: auditResult.responsiveAudit.mobileFriendly,
        responsiveLayout: auditResult.responsiveAudit.responsiveLayout,
        horizontalScroll: auditResult.responsiveAudit.horizontalScroll,
        overflowIssues: auditResult.responsiveAudit.overflowIssues,
        viewportMeta: auditResult.responsiveAudit.viewportMeta,
        viewportContent: auditResult.responsiveAudit.viewportContent || undefined,
        touchFriendly: auditResult.responsiveAudit.touchFriendly,
        fontSizeIssues: auditResult.responsiveAudit.fontSizeIssues,
      };

      lead.uiuxAudit = {
        alignmentIssues: auditResult.uiuxAudit.alignmentIssues,
        brokenButtons: auditResult.uiuxAudit.brokenButtons,
        croppedSections: auditResult.uiuxAudit.croppedSections,
        mobileLayoutBroken: auditResult.uiuxAudit.mobileLayoutBroken,
        overlappingContent: auditResult.uiuxAudit.overlappingContent,
        hiddenContent: auditResult.uiuxAudit.hiddenContent,
        navigationIssues: auditResult.uiuxAudit.navigationIssues,
        spacingIssues: auditResult.uiuxAudit.spacingIssues,
        issues: auditResult.uiuxAudit.issues,
      };

      lead.responsiveScore = auditResult.scores.responsiveScore;
      lead.uiuxScore = auditResult.scores.uiuxScore;
      lead.mobileExperienceScore = auditResult.scores.mobileExperienceScore;

      lead.desktopScreenshot = auditResult.screenshots.desktopScreenshot || undefined;
      lead.mobileScreenshot = auditResult.screenshots.mobileScreenshot || undefined;

      lead.desktopMetrics = auditResult.desktopMetrics;
      lead.mobileMetrics = auditResult.mobileMetrics;

      lead.responsiveAuditCompleted = true;
      lead.responsiveAuditedAt = auditResult.auditedAt;

      logger.info(`[ResponsiveAuditService] Saving audit results to MongoDB for lead ${leadId}`);
      await lead.save();

      if (lead.hasWebsite && lead.website) {
        auditCache.set(`responsive:${leadId}`, lead, lead.website);
      }

      profiler.end();
      const totalDuration = Date.now() - startTime;
      logger.info({ leadId, duration: totalDuration, responsiveScore: lead.responsiveScore, uiuxScore: lead.uiuxScore, mobileScore: lead.mobileExperienceScore }, `[ResponsiveAuditService] AUDIT COMPLETED for lead ${leadId} in ${totalDuration}ms`);
      
      return lead;
    } catch (error) {
      profiler.end();
      const totalDuration = Date.now() - startTime;
      logger.error({ err: error instanceof Error ? error.message : String(error), leadId, duration: totalDuration }, `[ResponsiveAuditService] AUDIT FAILED for lead ${leadId} after ${totalDuration}ms`);
      
      try {
        const lead = await Lead.findById(leadId);
        if (lead) {
          lead.responsiveAuditCompleted = false;
          lead.responsiveScore = 0;
          lead.uiuxScore = 0;
          lead.mobileExperienceScore = 0;
          lead.responsiveAudit = {
            mobileFriendly: false,
            responsiveLayout: false,
            horizontalScroll: false,
            overflowIssues: false,
            viewportMeta: false,
            viewportContent: undefined,
            touchFriendly: false,
            fontSizeIssues: true,
          };
          lead.uiuxAudit = {
            alignmentIssues: false,
            brokenButtons: false,
            croppedSections: false,
            mobileLayoutBroken: false,
            overlappingContent: false,
            hiddenContent: false,
            navigationIssues: false,
            spacingIssues: false,
            issues: [],
          };
          lead.responsiveAuditedAt = new Date();
          await lead.save();
          logger.info(`[ResponsiveAuditService] Marked lead ${leadId} as audit failed with default scores in database`);
        }
      } catch (saveError) {
        logger.error(saveError instanceof Error ? saveError : new Error(String(saveError)), `[ResponsiveAuditService] Failed to save failed audit state for lead ${leadId}`);
      }
      
      return null;
    }
  }

  async auditMultipleLeads(
    leadIds: string[],
    options: ResponsiveAuditOptions = {}
  ): Promise<BulkAuditResult> {
    logger.info(`Starting bulk responsive audit for ${leadIds.length} leads`);

    const results = await Promise.all(
      leadIds.map(leadId =>
        this.limit(async () => {
          try {
            const lead = await this.auditLead(leadId, options);
            return {
              leadId,
              success: !!lead,
            };
          } catch (error) {
            logger.error(error instanceof Error ? error : new Error(String(error)), `Bulk audit failed for lead ${leadId}:`);
            return {
              leadId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      )
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info(`Bulk responsive audit completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      message: `Audited ${leadIds.length} leads: ${successful} successful, ${failed} failed`,
      totalProcessed: leadIds.length,
      successful,
      failed,
      results,
    };
  }

  async auditLeadsWithoutAudit(
    options: ResponsiveAuditOptions & { limit?: number } = {}
  ): Promise<BulkAuditResult> {
    try {
      const limit = options.limit || 50;

      const leads = await Lead.find({
        website: { $exists: true, $nin: [null, ''] },
        responsiveAuditCompleted: { $ne: true },
      })
        .limit(limit)
        .select('_id website');

      if (leads.length === 0) {
        logger.info('No leads found without responsive audit');
        return {
          success: true,
          message: 'No leads found without responsive audit',
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
        };
      }

      logger.info(`Found ${leads.length} leads without responsive audit`);

      const leadIds = leads.map(lead => lead._id.toString());
      return await this.auditMultipleLeads(leadIds, options);
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to audit leads without audit:');
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }
  }

  async getAuditStats(): Promise<{
    total: number;
    audited: number;
    notAudited: number;
    averageResponsiveScore: number;
    averageUiuxScore: number;
    averageMobileScore: number;
    mobileUnfriendly: number;
    layoutIssues: number;
    alignmentIssues: number;
    horizontalScrollIssues: number;
  }> {
    try {
      const total = await Lead.countDocuments({ website: { $exists: true, $nin: [null, ''] } });
      const audited = await Lead.countDocuments({ responsiveAuditCompleted: true });
      const notAudited = total - audited;

      const scoreAggregation = await Lead.aggregate([
        { $match: { responsiveAuditCompleted: true } },
        {
          $group: {
            _id: null,
            avgResponsive: { $avg: '$responsiveScore' },
            avgUiux: { $avg: '$uiuxScore' },
            avgMobile: { $avg: '$mobileExperienceScore' },
          },
        },
      ]);

      const mobileUnfriendly = await Lead.countDocuments({
        'responsiveAudit.mobileFriendly': false,
      });

      const layoutIssues = await Lead.countDocuments({
        'responsiveAudit.responsiveLayout': false,
      });

      const alignmentIssues = await Lead.countDocuments({
        'uiuxAudit.alignmentIssues': true,
      });

      const horizontalScrollIssues = await Lead.countDocuments({
        'responsiveAudit.horizontalScroll': true,
      });

      const scores = scoreAggregation[0] || {
        avgResponsive: 0,
        avgUiux: 0,
        avgMobile: 0,
      };

      return {
        total,
        audited,
        notAudited,
        averageResponsiveScore: Math.round(scores.avgResponsive || 0),
        averageUiuxScore: Math.round(scores.avgUiux || 0),
        averageMobileScore: Math.round(scores.avgMobile || 0),
        mobileUnfriendly,
        layoutIssues,
        alignmentIssues,
        horizontalScrollIssues,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to get audit stats:');
      return {
        total: 0,
        audited: 0,
        notAudited: 0,
        averageResponsiveScore: 0,
        averageUiuxScore: 0,
        averageMobileScore: 0,
        mobileUnfriendly: 0,
        layoutIssues: 0,
        alignmentIssues: 0,
        horizontalScrollIssues: 0,
      };
    }
  }

  async reauditLead(leadId: string, options: ResponsiveAuditOptions = {}): Promise<ILead | null> {
    logger.info(`Re-auditing lead ${leadId}`);
    return await this.auditLead(leadId, options);
  }
}

export const responsiveAuditService = new ResponsiveAuditService();
