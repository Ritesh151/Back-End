import { Lead, ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import { businessIntelligenceEngine } from '../business-intelligence';
import { websiteAnalysisService } from './website-analysis.service';
import { auditCache } from './audit-cache.service';
import { withTimeout } from '../utils/audit-timeout';
import { profiler } from './performance-profiler.service';
import pLimit from 'p-limit';

interface BusinessIntelligenceOptions {
  timeout?: number;
  includeDeepAnalysis?: boolean;
}

interface BulkIntelligenceResult {
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

export class BusinessIntelligenceService {
  private readonly maxConcurrent = 3;
  private readonly limit = pLimit(this.maxConcurrent);

  async analyzeLead(leadId: string, options: BusinessIntelligenceOptions = {}): Promise<ILead | null> {
    profiler.start(`business-intel:${leadId}`, { leadId });
    try {
      const lead = await Lead.findById(leadId);

      if (!lead) {
        logger.warn(`Lead not found: ${leadId}`);
        return null;
      }

      if (!lead.hasWebsite || !lead.website) {
        logger.warn(`Lead ${leadId} has no website`);
        return lead;
      }

      const analysis = websiteAnalysisService.resolveLead(lead);

      if (!analysis.analysisEligible) {
        logger.warn(`[BusinessIntelligenceService] Lead ${leadId} is not analysis-eligible (websiteType=${lead.websiteType}) — skipping intelligence`);
        return lead;
      }

      logger.info('[BusinessIntelligence] AI Started');

      if (lead.intelligenceCompleted && !options.includeDeepAnalysis) {
        const cacheKey = `intelligence:${leadId}`;
        const cached = auditCache.getByWebsiteHash<ILead>(cacheKey, lead.website);
        if (cached.isCached) {
          logger.info(`Returning cached intelligence for lead ${leadId}`);
          return cached.data;
        }
      }

      logger.info(`Starting business intelligence analysis for lead ${leadId}: ${lead.website}`);

      const existingData = {
        sslEnabled: lead.sslEnabled || false,
        seoScore: lead.seoScore || 0,
        responsiveScore: lead.responsiveScore || 0,
        uiuxScore: lead.uiuxScore || 0,
        responseTime: lead.responseTime || 0,
      };

      const report = await withTimeout(businessIntelligenceEngine.analyzeWebsite(
        lead.website,
        existingData,
        options
      ), 90000, `BusinessIntelligence.analyzeWebsite(${leadId})`);

      if (!report.intelligenceCompleted) {
        logger.warn(`Business intelligence did not complete for lead ${leadId}: ${lead.website}`);
        lead.intelligenceCompleted = false;
        await lead.save();
        return lead;
      }

      lead.footerAudit = {
        copyrightDetected: report.footerAnalysis.copyrightDetected,
        copyrightYear: report.footerAnalysis.copyrightYear,
        privacyPolicy: report.footerAnalysis.privacyPolicy,
        termsPage: report.footerAnalysis.termsPage,
        footerComplete: report.footerAnalysis.footerComplete,
        footerLinks: report.footerAnalysis.footerLinks,
        hasContactInfo: report.footerAnalysis.hasContactInfo,
      };

      lead.socialAudit = {
        instagram: report.socialAudit.instagram,
        facebook: report.socialAudit.facebook,
        linkedin: report.socialAudit.linkedin,
        twitter: report.socialAudit.twitter,
        youtube: report.socialAudit.youtube,
        whatsapp: report.socialAudit.whatsapp,
        socialPresenceScore: report.socialAudit.socialPresenceScore,
        detectedLinks: report.socialAudit.detectedLinks,
      };

      lead.contactAudit = {
        phoneDetected: report.contactAudit.phoneDetected,
        emailDetected: report.contactAudit.emailDetected,
        contactForm: report.contactAudit.contactForm,
        googleMapsEmbed: report.contactAudit.googleMapsEmbed,
        officeAddress: report.contactAudit.officeAddress,
        whatsappButton: report.contactAudit.whatsappButton,
        contactMethods: report.contactAudit.contactMethods,
      };

      lead.trustScore = report.trustScore.score;
      lead.trustScoreLevel = report.trustScore.level;

      lead.websiteFreshness = {
        status: report.websiteFreshness.status,
        copyrightYear: report.websiteFreshness.copyrightYear,
        yearsBehind: report.websiteFreshness.yearsBehind,
        staleCopyright: report.websiteFreshness.staleCopyright,
        designGeneration: report.websiteFreshness.designGeneration,
        modernStandards: report.websiteFreshness.modernStandards,
      };

      lead.businessOpportunity = {
        level: report.businessOpportunity.level,
        score: report.businessOpportunity.score,
        reasons: report.businessOpportunity.reasons,
        recommendation: report.businessOpportunity.recommendation,
        estimatedValue: report.businessOpportunity.estimatedValue,
      };

      lead.seoScore = report.websiteQualityScore.breakdown.seo;
      lead.websiteQualityScore = report.websiteQualityScore.overall;
      lead.socialPresenceScore = report.socialAudit.socialPresenceScore;
      lead.copyrightYear = report.footerAnalysis.copyrightYear ?? undefined;

      lead.aiRecommendation = {
        summary: report.aiRecommendation.summary,
        services: report.aiRecommendation.services,
        priority: report.aiRecommendation.priority,
        estimatedImpact: report.aiRecommendation.estimatedImpact,
        keyIssues: report.aiRecommendation.keyIssues,
      };

      lead.intelligenceCompleted = report.intelligenceCompleted;
      lead.intelligenceAnalyzedAt = report.analyzedAt;

      await lead.save();

      if (lead.hasWebsite && lead.website) {
        auditCache.set(`intelligence:${leadId}`, lead, lead.website);
      }

      profiler.end();
      logger.info({ leadId, trustScore: lead.trustScore, opportunity: lead.businessOpportunity?.level }, `Business intelligence completed for lead ${leadId}`);
      return lead;
    } catch (error) {
      profiler.end();
      logger.error({ err: error instanceof Error ? error.message : String(error), leadId }, `Failed to analyze business intelligence for lead ${leadId}:`);

      try {
        const lead = await Lead.findById(leadId);
        if (lead) {
          lead.intelligenceCompleted = false;
          await lead.save();
        }
      } catch {}

      return null;
    }
  }

  async analyzeMultipleLeads(
    leadIds: string[],
    options: BusinessIntelligenceOptions = {}
  ): Promise<BulkIntelligenceResult> {
    logger.info(`Starting bulk business intelligence analysis for ${leadIds.length} leads`);

    const results = await Promise.all(
      leadIds.map(leadId =>
        this.limit(async () => {
          try {
            const lead = await this.analyzeLead(leadId, options);
            return {
              leadId,
              success: !!lead,
            };
          } catch (error) {
            logger.error(error instanceof Error ? error : new Error(String(error)), `Bulk intelligence failed for lead ${leadId}:`);
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

    logger.info(`Bulk business intelligence completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      message: `Analyzed ${leadIds.length} leads: ${successful} successful, ${failed} failed`,
      totalProcessed: leadIds.length,
      successful,
      failed,
      results,
    };
  }

  async analyzeLeadsWithoutIntelligence(
    options: BusinessIntelligenceOptions & { limit?: number } = {}
  ): Promise<BulkIntelligenceResult> {
    try {
      const limit = options.limit || 50;

      const leads = await Lead.find({
        website: { $exists: true, $nin: [null, ''] },
        intelligenceCompleted: { $ne: true },
      })
        .limit(limit)
        .select('_id website');

      if (leads.length === 0) {
        logger.info('No leads found without business intelligence');
        return {
          success: true,
          message: 'No leads found without business intelligence',
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
        };
      }

      logger.info(`Found ${leads.length} leads without business intelligence`);
      const leadIds = leads.map(lead => lead._id.toString());
      return await this.analyzeMultipleLeads(leadIds, options);
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to analyze leads without intelligence:');
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

  async getIntelligenceStats(): Promise<{
    total: number;
    analyzed: number;
    notAnalyzed: number;
    averageTrustScore: number;
    averageQualityScore: number;
    highOpportunity: number;
    mediumOpportunity: number;
    lowOpportunity: number;
    websitesWithOutdatedDesign: number;
    businessesWithoutSocial: number;
    businessesWithoutContactForm: number;
    weakTrustScore: number;
    outdatedCopyright: number;
  }> {
    try {
      const total = await Lead.countDocuments({ website: { $exists: true, $nin: [null, ''] } });
      const analyzed = await Lead.countDocuments({ intelligenceCompleted: true });
      const notAnalyzed = total - analyzed;

      const scoreAggregation = await Lead.aggregate([
        { $match: { intelligenceCompleted: true } },
        {
          $group: {
            _id: null,
            avgTrustScore: { $avg: '$trustScore' },
            avgQualityScore: { $avg: '$websiteQualityScore' },
          },
        },
      ]);

      const highOpportunity = await Lead.countDocuments({
        'businessOpportunity.level': 'high',
      });

      const mediumOpportunity = await Lead.countDocuments({
        'businessOpportunity.level': 'medium',
      });

      const lowOpportunity = await Lead.countDocuments({
        'businessOpportunity.level': 'low',
      });

      const websitesWithOutdatedDesign = await Lead.countDocuments({
        'websiteFreshness.status': { $in: ['outdated', 'very-outdated'] },
      });

      const businessesWithoutSocial = await Lead.countDocuments({
        intelligenceCompleted: true,
        'socialAudit.socialPresenceScore': { $lt: 40 },
      });

      const businessesWithoutContactForm = await Lead.countDocuments({
        'contactAudit.contactForm': false,
      });

      const weakTrustScore = await Lead.countDocuments({
        trustScore: { $lt: 50 },
      });

      const outdatedCopyright = await Lead.countDocuments({
        copyrightYear: { $lt: new Date().getFullYear() - 2 },
      });

      const scores = scoreAggregation[0] || {
        avgTrustScore: 0,
        avgQualityScore: 0,
      };

      return {
        total,
        analyzed,
        notAnalyzed,
        averageTrustScore: Math.round(scores.avgTrustScore || 0),
        averageQualityScore: Math.round(scores.avgQualityScore || 0),
        highOpportunity,
        mediumOpportunity,
        lowOpportunity,
        websitesWithOutdatedDesign,
        businessesWithoutSocial,
        businessesWithoutContactForm,
        weakTrustScore,
        outdatedCopyright,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to get intelligence stats:');
      return {
        total: 0,
        analyzed: 0,
        notAnalyzed: 0,
        averageTrustScore: 0,
        averageQualityScore: 0,
        highOpportunity: 0,
        mediumOpportunity: 0,
        lowOpportunity: 0,
        websitesWithOutdatedDesign: 0,
        businessesWithoutSocial: 0,
        businessesWithoutContactForm: 0,
        weakTrustScore: 0,
        outdatedCopyright: 0,
      };
    }
  }

  async reanalyzeLead(leadId: string, options: BusinessIntelligenceOptions = {}): Promise<ILead | null> {
    logger.info(`Re-analyzing business intelligence for lead ${leadId}`);
    return await this.analyzeLead(leadId, options);
  }
}

export const businessIntelligenceService = new BusinessIntelligenceService();
