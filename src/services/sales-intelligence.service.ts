import { Lead, ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import { salesIntelligenceEngine } from '../ai-sales-intelligence';
import pLimit from 'p-limit';

interface SalesIntelligenceOptions {
  timeout?: number;
}

interface BulkSalesResult {
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

export class SalesIntelligenceService {
  private readonly maxConcurrent = 5;
  private readonly limit = pLimit(this.maxConcurrent);

  async analyzeLead(leadId: string, _options: SalesIntelligenceOptions = {}): Promise<ILead | null> {
    try {
      const lead = await Lead.findById(leadId);

      if (!lead) {
        logger.warn(`Lead not found: ${leadId}`);
        return null;
      }

      logger.info(`Starting AI sales intelligence for lead ${leadId}: ${lead.companyName}`);

      const competitorContext = await this.getCompetitorContext(lead);

      const report = await salesIntelligenceEngine.analyze(lead, competitorContext);

      lead.aiLeadScore = report.aiLeadScore;
      lead.conversionProbability = report.conversionProbability;
      lead.websiteRedesignPotential = report.websiteRedesignPotential;
      lead.seoOpportunity = report.seoOpportunity;
      lead.digitalMarketingOpportunity = report.digitalMarketingOpportunity;
      lead.revenuePotential = report.revenuePotential;
      lead.salesPriority = report.salesPriority;
      lead.aiInsight = report.aiInsight;
      lead.competitionLevel = report.competitionLevel;
      lead.marketOpportunity = report.marketOpportunity;
      lead.salesIntelligenceCompleted = report.salesIntelligenceCompleted;
      lead.salesIntelligenceAnalyzedAt = report.analyzedAt;

      await lead.save();

      logger.info(`Sales intelligence completed for lead ${leadId}: score=${report.aiLeadScore}, priority=${report.salesPriority}`);
      return lead;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Failed sales intelligence for lead ${leadId}:`);

      try {
        const lead = await Lead.findById(leadId);
        if (lead) {
          lead.salesIntelligenceCompleted = false;
          await lead.save();
        }
      } catch {}

      return null;
    }
  }

  async analyzeMultipleLeads(
    leadIds: string[],
    options: SalesIntelligenceOptions = {}
  ): Promise<BulkSalesResult> {
    logger.info(`Starting bulk sales intelligence for ${leadIds.length} leads`);

    const results = await Promise.all(
      leadIds.map(leadId =>
        this.limit(async () => {
          try {
            const lead = await this.analyzeLead(leadId, options);
            return { leadId, success: !!lead };
          } catch (error) {
            logger.error(error instanceof Error ? error : new Error(String(error)), `Bulk sales intelligence failed for lead ${leadId}:`);
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

    logger.info(`Bulk sales intelligence completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      message: `Analyzed ${leadIds.length} leads: ${successful} successful, ${failed} failed`,
      totalProcessed: leadIds.length,
      successful,
      failed,
      results,
    };
  }

  async analyzeLeadsWithoutAnalysis(
    options: SalesIntelligenceOptions & { limit?: number } = {}
  ): Promise<BulkSalesResult> {
    try {
      const limit = options.limit || 50;

      const leads = await Lead.find({
        salesIntelligenceCompleted: { $ne: true },
      })
        .limit(limit)
        .select('_id companyName');

      if (leads.length === 0) {
        logger.info('No leads found without sales intelligence');
        return {
          success: true,
          message: 'No leads found without sales intelligence',
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
        };
      }

      logger.info(`Found ${leads.length} leads without sales intelligence`);
      const leadIds = leads.map(lead => lead._id.toString());
      return await this.analyzeMultipleLeads(leadIds, options);
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to analyze leads without sales intelligence:');
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

  async getSalesStats(): Promise<{
    total: number;
    analyzed: number;
    notAnalyzed: number;
    averageAiScore: number;
    urgentLeads: number;
    highPriorityLeads: number;
    highConversionLeads: number;
    highRedesignPotential: number;
    highSeoOpportunity: number;
    enterpriseRevenue: number;
    highRevenue: number;
  }> {
    try {
      const total = await Lead.countDocuments();
      const analyzed = await Lead.countDocuments({ salesIntelligenceCompleted: true });
      const notAnalyzed = total - analyzed;

      const scoreAgg = await Lead.aggregate([
        { $match: { salesIntelligenceCompleted: true } },
        { $group: { _id: null, avgScore: { $avg: '$aiLeadScore' } } },
      ]);

      const [
        urgentLeads,
        highPriorityLeads,
        highConversionLeads,
        highRedesignPotential,
        highSeoOpportunity,
        enterpriseRevenue,
        highRevenue,
      ] = await Promise.all([
        Lead.countDocuments({ salesPriority: 'urgent' }),
        Lead.countDocuments({ salesPriority: 'high' }),
        Lead.countDocuments({ conversionProbability: 'high' }),
        Lead.countDocuments({ websiteRedesignPotential: 'high' }),
        Lead.countDocuments({ seoOpportunity: 'high' }),
        Lead.countDocuments({ revenuePotential: 'enterprise' }),
        Lead.countDocuments({ revenuePotential: 'high' }),
      ]);

      return {
        total,
        analyzed,
        notAnalyzed,
        averageAiScore: Math.round(scoreAgg[0]?.avgScore || 0),
        urgentLeads,
        highPriorityLeads,
        highConversionLeads,
        highRedesignPotential,
        highSeoOpportunity,
        enterpriseRevenue,
        highRevenue,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to get sales stats:');
      return {
        total: 0, analyzed: 0, notAnalyzed: 0, averageAiScore: 0,
        urgentLeads: 0, highPriorityLeads: 0, highConversionLeads: 0,
        highRedesignPotential: 0, highSeoOpportunity: 0,
        enterpriseRevenue: 0, highRevenue: 0,
      };
    }
  }

  private async getCompetitorContext(lead: ILead): Promise<{
    totalLeadsInSameArea: number;
    totalLeadsInSameCategory: number;
    averageScoreInCategory: number;
    averageTrustScoreInCategory: number;
  }> {
    try {
      const area = lead.searchedArea;
      const category = lead.category;

      const [areaCount, categoryCount, categoryScoreAgg, categoryTrustAgg] = await Promise.all([
        area ? Lead.countDocuments({ searchedArea: area }) : Promise.resolve(0),
        category ? Lead.countDocuments({ category }) : Promise.resolve(0),
        category
          ? Lead.aggregate([
              { $match: { category, aiLeadScore: { $exists: true } } },
              { $group: { _id: null, avgScore: { $avg: '$aiLeadScore' } } },
            ])
          : Promise.resolve([]),
        category
          ? Lead.aggregate([
              { $match: { category, trustScore: { $exists: true } } },
              { $group: { _id: null, avgScore: { $avg: '$trustScore' } } },
            ])
          : Promise.resolve([]),
      ]);

      return {
        totalLeadsInSameArea: areaCount,
        totalLeadsInSameCategory: categoryCount,
        averageScoreInCategory: Math.round(categoryScoreAgg[0]?.avgScore || 0),
        averageTrustScoreInCategory: Math.round(categoryTrustAgg[0]?.avgScore || 0),
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to get competitor context:');
      return { totalLeadsInSameArea: 0, totalLeadsInSameCategory: 0, averageScoreInCategory: 0, averageTrustScoreInCategory: 0 };
    }
  }
}

export const salesIntelligenceService = new SalesIntelligenceService();
