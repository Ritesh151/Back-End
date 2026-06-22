import { logger } from '../utils/logger';
import { Lead, ILead } from '../models/Lead';
import { websiteAnalyzerService } from './website-analyzer.service';
import {
  QualificationLevel,
  WebsiteStatus,
  LeadAnalysis,
  AnalysisResult,
} from '../types/analysis.types';
export class LeadQualificationService {
  /**
   * Qualify a single lead based on their website analysis
   */
  async qualifyLead(leadId: string, website?: string): Promise<ILead | null> {
    if (!website) {
      logger.warn(`Lead ${leadId}: No website provided for qualification`);
      return null;
    }

    try {
      // Analyze the website
      const leadAnalysis = await websiteAnalyzerService.analyzeLead(leadId, website);

      // Get current lead
      const lead = await Lead.findById(leadId);
      if (!lead) {
        logger.warn(`Lead not found: ${leadId}`);
        return null;
      }

      // Update lead with analysis results
      lead.websiteStatus = leadAnalysis.websiteStatus;
      lead.leadScore = leadAnalysis.leadScore;
      lead.qualificationLevel = leadAnalysis.qualificationLevel;
      lead.sslEnabled = leadAnalysis.analysisData.sslEnabled;
      lead.responseTime = leadAnalysis.analysisData.responseTime;
      lead.metaTitle = leadAnalysis.analysisData.metaTitle;
      lead.metaDescription = leadAnalysis.analysisData.metaDescription;
      lead.hasContactPage = leadAnalysis.analysisData.hasContactPage;
      lead.hasSocialLinks = leadAnalysis.analysisData.hasSocialLinks;
      lead.analyzedAt = new Date(leadAnalysis.analyzedAt);

      await lead.save();

      logger.info(`Lead ${leadId} qualified: Score=${lead.leadScore}, Status=${lead.websiteStatus}, Level=${lead.qualificationLevel}`);

      return lead;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to qualify lead ${leadId}:`);
      
      // Still update the lead with basic info even if analysis failed
      const lead = await Lead.findById(leadId);
      if (lead) {
        lead.websiteStatus = 'broken-website';
        lead.leadScore = 90;
        lead.qualificationLevel = 'low-potential';
        lead.analyzedAt = new Date();
        await lead.save();
      }

      return null;
    }
  }

  /**
   * Bulk qualify leads based on their websites
   */
  async bulkQualifyLeads(options: {
    limit?: number;
    websiteStatus?: WebsiteStatus;
    minLeadScore?: number;
  } = {}): Promise<AnalysisResult> {
    const { limit = 50, websiteStatus, minLeadScore } = options;

    logger.info(`Bulk qualifying leads (limit: ${limit}, status: ${websiteStatus}, minScore: ${minLeadScore})`);

    // Build query
    const query: any = {
      website: { $exists: true, $ne: null },
      $or: [
        { website: { $ne: '' } },
        { website: { $exists: false } },
      ],
    };

    // Filter by website status
    if (websiteStatus) {
      query.websiteStatus = websiteStatus;
    }

    // Filter by minimum lead score
    if (minLeadScore !== undefined) {
      query.leadScore = { $lt: minLeadScore };
    }

    // Get leads to qualify
    const leads = await Lead.find(query)
      .limit(limit)
      .lean();

    if (leads.length === 0) {
      logger.info('No leads found matching criteria');
      return {
        success: true,
        message: 'No leads found matching criteria',
        totalAnalyzed: 0,
        results: [],
      };
    }

    logger.info(`Found ${leads.length} leads to qualify`);

    // Analyze each lead
    const results: LeadAnalysis[] = [];
    let successful = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        const website = lead.website || '';
        
        if (!website) {
          failed++;
          continue;
        }

        const leadAnalysis = await websiteAnalyzerService.analyzeLead(lead.id, website);

        // Update the lead
        await Lead.findByIdAndUpdate(lead.id, {
          websiteStatus: leadAnalysis.websiteStatus,
          leadScore: leadAnalysis.leadScore,
          qualificationLevel: leadAnalysis.qualificationLevel,
          sslEnabled: leadAnalysis.analysisData.sslEnabled,
          responseTime: leadAnalysis.analysisData.responseTime,
          metaTitle: leadAnalysis.analysisData.metaTitle,
          metaDescription: leadAnalysis.analysisData.metaDescription,
          hasContactPage: leadAnalysis.analysisData.hasContactPage,
          hasSocialLinks: leadAnalysis.analysisData.hasSocialLinks,
          analyzedAt: new Date(leadAnalysis.analyzedAt),
          updatedAt: new Date(),
        });

        results.push(leadAnalysis);
        successful++;

        logger.info(`Qualified lead ${lead.id}: Score=${leadAnalysis.leadScore}, Status=${leadAnalysis.websiteStatus}, Level=${leadAnalysis.qualificationLevel}`);
      } catch (error) {
        logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to qualify lead ${lead.id}:`);
        failed++;
      }
    }

    logger.info(`Bulk qualification completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      message: `Qualified ${successful} leads, ${failed} failed`,
      totalAnalyzed: successful,
      results,
    };
  }

  /**
   * Get qualified leads with filtering
   */
  async getQualifiedLeads(options: {
    page?: number;
    limit?: number;
    qualificationLevel?: QualificationLevel;
    websiteStatus?: WebsiteStatus;
    minLeadScore?: number;
    maxLeadScore?: number;
  } = {}): Promise<{
    leads: ILead[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      qualificationLevel,
      websiteStatus,
      minLeadScore,
      maxLeadScore,
    } = options;

    logger.info(`Fetching qualified leads (page: ${page}, limit: ${limit})`);

    const query: any = {};

    // Filter by qualification level
    if (qualificationLevel) {
      query.qualificationLevel = qualificationLevel;
    }

    // Filter by website status
    if (websiteStatus) {
      query.websiteStatus = websiteStatus;
    }

    // Filter by lead score range
    if (minLeadScore !== undefined || maxLeadScore !== undefined) {
      query.leadScore = {};
      if (minLeadScore !== undefined) {
        query.leadScore.$gte = minLeadScore;
      }
      if (maxLeadScore !== undefined) {
        query.leadScore.$lte = maxLeadScore;
      }
    }

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort({ leadScore: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.info(`Returned ${leads.length} leads out of ${total} total qualified leads`);

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get statistics about qualified leads
   */
  async getQualificationStats(): Promise<{
    totalLeads: number;
    qualifiedLeads: number;
    byStatus: Record<string, number>;
    byLevel: Record<string, number>;
    avgScore: number;
  }> {
    const totalLeads = await Lead.countDocuments();
    const qualifiedLeads = await Lead.countDocuments({ leadScore: { $gt: 0 } });

    // Group by website status
    const statusAggregation = await Lead.aggregate([
      {
        $match: { websiteStatus: { $ne: null } },
      },
      {
        $group: {
          _id: '$websiteStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    // Group by qualification level
    const levelAggregation = await Lead.aggregate([
      {
        $match: { qualificationLevel: { $ne: null } },
      },
      {
        $group: {
          _id: '$qualificationLevel',
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate average score
    const scoreAggregation = await Lead.aggregate([
      {
        $match: { leadScore: { $gt: 0 } },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$leadScore' },
        },
      },
    ]);

    // Build status count object
    const byStatus: Record<string, number> = {};
    for (const item of statusAggregation) {
      byStatus[item._id] = item.count;
    }

    // Build level count object
    const byLevel: Record<string, number> = {};
    for (const item of levelAggregation) {
      byLevel[item._id] = item.count;
    }

    const avgScore = scoreAggregation.length > 0 ? Math.round(scoreAggregation[0].avgScore) : 0;

    return {
      totalLeads,
      qualifiedLeads,
      byStatus,
      byLevel,
      avgScore,
    };
  }

  /**
   * Get leads by qualification level
   */
  async getLeadsByLevel(level: QualificationLevel): Promise<ILead[]> {
    const leads = await Lead.find({ qualificationLevel: level })
      .sort({ leadScore: -1, createdAt: -1 });

    logger.info(`Found ${leads.length} leads with level: ${level}`);

    return leads;
  }

  /**
   * Get leads by website status
   */
  async getLeadsByStatus(status: WebsiteStatus): Promise<ILead[]> {
    const leads = await Lead.find({ websiteStatus: status })
      .sort({ leadScore: -1, createdAt: -1 });

    logger.info(`Found ${leads.length} leads with status: ${status}`);

    return leads;
  }

  /**
   * Re-qualify all leads that haven't been analyzed yet
   */
  async requalifyUnanalyzedLeads(options: { limit?: number } = {}): Promise<AnalysisResult> {
    const { limit = 50 } = options;

    logger.info('Re-qualifying unanalyzed leads');

    const unanalyzedLeads = await Lead.find({
      $or: [
        { leadScore: 0 },
        { leadScore: { $exists: false } },
        { analyzedAt: { $exists: false } },
      ],
    })
      .limit(limit);

    if (unanalyzedLeads.length === 0) {
      logger.info('All leads are already analyzed');
      return {
        success: true,
        message: 'All leads are already analyzed',
        totalAnalyzed: 0,
        results: [],
      };
    }

    // Call bulkQualifyLeads with the unanalyzed leads
    const result = await this.bulkQualifyLeads({
      limit,
      websiteStatus: undefined,
    });

    return result;
  }
}

export const leadQualificationService = new LeadQualificationService();
