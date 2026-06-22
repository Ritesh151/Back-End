import { Lead } from '../models/Lead';
import { Automation, AutomationHistory, ExportHistory } from '../models/Automation';
import { logger } from '../utils/logger';

// Date range options
export type DateRange = 'today' | 'last7days' | 'last30days' | 'custom';

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

// Analytics Interfaces
export interface LeadAnalytics {
  totalLeads: number;
  highPotential: number;
  mediumPotential: number;
  lowPotential: number;
  averageLeadScore: number;
  qualificationDistribution: {
    highPotential: number;
    mediumPotential: number;
    lowPotential: number;
    total: number;
  };
}

export interface ScrapingAnalytics {
  totalScrapes: number;
  successfulScrapes: number;
  failedScrapes: number;
  successRate: number;
  leadsPerScrape: number;
}

export interface AutomationAnalytics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  totalLeadsGenerated: number;
  exportsGenerated: number;
}

export interface ExportAnalytics {
  totalExports: number;
  csvExports: number;
  excelExports: number;
  totalRecords: number;
}

export interface OverviewAnalytics {
  totalLeads: number;
  websitesAnalyzed: number;
  emailsFound: number;
  phoneNumbers: number;
  totalAutomations: number;
  highPotentialLeads: number;
  websitesWithoutSsl: number;
  noWebsiteBusinesses: number;
  emailsExtracted: number;
  automationRuns: number;
  exportsGenerated: number;
  totalScrapes: number;
  scrapingSuccessRate: number;
  // Responsive audit statistics
  responsiveAudited: number;
  averageResponsiveScore: number;
  averageUIUXScore: number;
  mobileUnfriendlyWebsites: number;
  layoutIssuesDetected: number;
  // Business intelligence statistics
  intelligenceAnalyzed: number;
  averageTrustScore: number;
  averageQualityScore: number;
  highOpportunityLeads: number;
  outdatedWebsites: number;
  businessesWithoutSocial: number;
  // AI Sales Intelligence statistics
  salesIntelligenceAnalyzed: number;
  urgentSalesLeads: number;
  highConversionLeads: number;
  averageAiScore: number;
  highSeoOpportunities: number;
  highRedesignOpportunities: number;
  // AI Outreach statistics
  outreachCompleted: number;
  pendingOutreach: number;
  highProbabilityOutreach: number;
  outreachResponded: number;
  outreachInterested: number;
  // Mega AI Pipeline statistics
  fullPipelineCompleted: number;
  pendingFullPipeline: number;
}

// Aggregation Results
export interface CategoryCount {
  _id: string;
  count: number;
}

export interface LeadPerDay {
  _id: {
    year: number;
    month: number;
    day: number;
  };
  count: number;
}

export interface AreaDensityItem {
  state: string;
  city: string;
  area: string;
  totalLeads: number;
  densityLevel: 'high' | 'medium' | 'low';
  topCategories: Array<{ category: string; count: number }>;
}

export class AnalyticsService {
  /**
   * Get overview analytics
   */
  async getOverview(filter: DateRangeFilter = {}): Promise<OverviewAnalytics> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const [
        totalLeads,
        highPotentialLeads,
        websitesWithoutSsl,
        noWebsiteBusinesses,
        emailsAgg,
        phonesAgg,
        websitesAgg,
        totalAutomations,
        totalExports,
      ] = await Promise.all([
        // Total leads - ALL leads
        Lead.countDocuments(dateQuery),

        // High potential leads
        Lead.countDocuments({
          ...dateQuery,
          qualificationLevel: 'high-potential',
        }),

        // Websites without SSL
        Lead.countDocuments({
          ...dateQuery,
          website: { $exists: true, $nin: [null, ''] },
          sslEnabled: false,
        }),

        // No website businesses
        Lead.countDocuments({
          ...dateQuery,
          $or: [
            { website: { $exists: false } },
            { website: null },
            { website: '' },
          ],
        }),

        // Total emails across all leads
        Lead.aggregate([
          { $match: dateQuery },
          { $project: { emailArray: { $ifNull: ['$emails', []] } } },
          { $group: { _id: null, count: { $sum: { $size: '$emailArray' } } } },
        ]),

        // Total phones across all leads
        Lead.aggregate([
          { $match: dateQuery },
          { $project: { phoneArray: { $ifNull: ['$phones', []] } } },
          { $group: { _id: null, count: { $sum: { $size: '$phoneArray' } } } },
        ]),

        // Leads with websites
        Lead.countDocuments({
          ...dateQuery,
          website: { $exists: true, $nin: [null, ''] },
        }),

        // Total automations
        Automation.countDocuments(),

        // Exports generated
        ExportHistory.countDocuments(),
      ]);

      const emailsFound = emailsAgg.length > 0 ? emailsAgg[0].count : 0;
      const phoneNumbers = phonesAgg.length > 0 ? phonesAgg[0].count : 0;
      const websitesAnalyzed = websitesAgg;

      const totalScrapes = await Lead.countDocuments({
        ...dateQuery,
        source: 'google-maps',
      });

      const scrapingSuccessRate = totalScrapes > 0 ? 100 : 0;

      // Responsive audit stats
      const [
        responsiveAudited,
        avgResponsiveAgg,
        mobileUnfriendlyWebsites,
        layoutIssuesDetected,
      ] = await Promise.all([
        Lead.countDocuments({ responsiveAuditCompleted: true }),
        Lead.aggregate([
          { $match: { responsiveAuditCompleted: true } },
          { $group: { _id: null, avgScore: { $avg: '$responsiveScore' } } },
        ]),
        Lead.countDocuments({ 'responsiveAudit.mobileFriendly': false }),
        Lead.countDocuments({ 'responsiveAudit.responsiveLayout': false }),
      ]);

      // Business intelligence stats
      const [
        intelligenceAnalyzed,
        avgTrustAgg,
        avgQualityAgg,
        highOpportunityLeads,
        outdatedWebsites,
        businessesWithoutSocial,
        salesIntelligenceAnalyzed,
        urgentSalesLeads,
        highConversionLeads,
        avgAiScoreAgg,
        highSeoOpportunities,
        highRedesignOpportunities,
      ] = await Promise.all([
        Lead.countDocuments({ intelligenceCompleted: true }),
        Lead.aggregate([
          { $match: { intelligenceCompleted: true } },
          { $group: { _id: null, avgScore: { $avg: '$trustScore' } } },
        ]),
        Lead.aggregate([
          { $match: { intelligenceCompleted: true } },
          { $group: { _id: null, avgScore: { $avg: '$websiteQualityScore' } } },
        ]),
        Lead.countDocuments({ 'businessOpportunity.level': 'high' }),
        Lead.countDocuments({
          'websiteFreshness.status': { $in: ['outdated', 'very-outdated'] },
        }),
        Lead.countDocuments({ socialPresenceScore: { $lt: 40 } }),
        // AI Sales Intelligence stats
        Lead.countDocuments({ salesIntelligenceCompleted: true }),
        Lead.countDocuments({ salesPriority: 'urgent' }),
        Lead.countDocuments({ conversionProbability: 'high' }),
        Lead.aggregate([
          { $match: { salesIntelligenceCompleted: true } },
          { $group: { _id: null, avgScore: { $avg: '$aiLeadScore' } } },
        ]),
        Lead.countDocuments({ seoOpportunity: 'high' }),
        Lead.countDocuments({ websiteRedesignPotential: 'high' }),
      ]);

      // AI Outreach stats
      const [
        outreachCompleted,
        pendingOutreach,
        highProbabilityOutreach,
        outreachResponded,
        outreachInterested,
      ] = await Promise.all([
        Lead.countDocuments({ outreachCompleted: true }),
        Lead.countDocuments({ $or: [{ outreachCompleted: { $ne: true } }, { outreachCompleted: { $exists: false } }] }),
        Lead.countDocuments({ outreachProbability: 'high' }),
        Lead.countDocuments({ 'outreachHistory.status': 'responded' }),
        Lead.countDocuments({ crmOutreachStatus: 'interested' }),
      ]);

      // Mega AI pipeline stats
      const [
        fullPipelineCompleted,
        pendingFullPipeline,
      ] = await Promise.all([
        Lead.countDocuments({
          responsiveAuditCompleted: true,
          intelligenceCompleted: true,
          salesIntelligenceCompleted: true,
          outreachCompleted: true,
        }),
        Lead.countDocuments({
          $or: [
            { responsiveAuditCompleted: { $ne: true } },
            { responsiveAuditCompleted: { $exists: false } },
          ],
        }),
      ]);

      logger.info(
        `AnalyticsService: Overview - totalLeads=${totalLeads}, websitesAnalyzed=${websitesAnalyzed}, emailsFound=${emailsFound}, phoneNumbers=${phoneNumbers}`
      );

      return {
        totalLeads,
        websitesAnalyzed,
        emailsFound,
        phoneNumbers,
        totalAutomations,
        highPotentialLeads,
        websitesWithoutSsl,
        noWebsiteBusinesses,
        emailsExtracted: emailsFound,
        automationRuns: totalAutomations,
        exportsGenerated: totalExports,
        totalScrapes,
        scrapingSuccessRate,
        responsiveAudited,
        averageResponsiveScore: Math.round(avgResponsiveAgg[0]?.avgScore || 0),
        averageUIUXScore: Math.round(avgResponsiveAgg[0]?.avgScore || 0),
        mobileUnfriendlyWebsites,
        layoutIssuesDetected,
        intelligenceAnalyzed,
        averageTrustScore: Math.round(avgTrustAgg[0]?.avgScore || 0),
        averageQualityScore: Math.round(avgQualityAgg[0]?.avgScore || 0),
        highOpportunityLeads,
        outdatedWebsites,
        businessesWithoutSocial,
        salesIntelligenceAnalyzed,
        urgentSalesLeads,
        highConversionLeads,
        averageAiScore: Math.round(avgAiScoreAgg[0]?.avgScore || 0),
        highSeoOpportunities,
        highRedesignOpportunities,
        outreachCompleted,
        pendingOutreach,
        highProbabilityOutreach,
        outreachResponded,
        outreachInterested,
        fullPipelineCompleted,
        pendingFullPipeline,
      };
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get overview:', error);
      throw new Error(`Failed to get overview analytics: ${error.message}`);
    }
  }

  /**
   * Get lead analytics
   */
  async getLeadAnalytics(filter: DateRangeFilter = {}): Promise<LeadAnalytics> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const [
        totalLeads,
        highPotential,
        mediumPotential,
        lowPotential,
        averageScore,
      ] = await Promise.all([
        Lead.countDocuments({ ...dateQuery }),
        Lead.countDocuments({ ...dateQuery, qualificationLevel: 'high-potential' }),
        Lead.countDocuments({ ...dateQuery, qualificationLevel: 'medium-potential' }),
        Lead.countDocuments({ ...dateQuery, qualificationLevel: 'low-potential' }),
        Lead.aggregate([
          { $match: dateQuery },
          { $group: { _id: null, avgScore: { $avg: '$leadScore' } } },
        ]),
      ]);

      const avgScore = averageScore.length > 0 ? averageScore[0].avgScore : 0;

      return {
        totalLeads,
        highPotential,
        mediumPotential,
        lowPotential,
        averageLeadScore: Math.round(avgScore * 100) / 100,
        qualificationDistribution: {
          highPotential,
          mediumPotential,
          lowPotential,
          total: totalLeads,
        },
      };
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get lead analytics:', error);
      throw new Error(`Failed to get lead analytics: ${error.message}`);
    }
  }

  /**
   * Get scraping analytics
   */
  async getScrapingAnalytics(filter: DateRangeFilter = {}): Promise<ScrapingAnalytics> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const [
        totalScrapes,
        successfulScrapes,
        failedScrapes,
        avgLeadsPerScrape,
      ] = await Promise.all([
        Lead.countDocuments({ ...dateQuery, source: 'google-maps' }),
        Lead.countDocuments({ 
          ...dateQuery, 
          source: 'google-maps',
          leadScore: { $gte: 50 },
        }),
        Lead.countDocuments({ 
          ...dateQuery, 
          source: 'google-maps',
          leadScore: { $lt: 50 },
        }),
        Lead.aggregate([
          { $match: dateQuery },
          { $group: { _id: null, avgLeads: { $avg: '$leadScore' } } },
        ]),
      ]);

      const successRate = totalScrapes > 0 
        ? Math.round((successfulScrapes / totalScrapes) * 100) 
        : 0;

      return {
        totalScrapes,
        successfulScrapes,
        failedScrapes,
        successRate,
        leadsPerScrape: Math.round(avgLeadsPerScrape[0]?.avgLeads || 0),
      };
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get scraping analytics:', error);
      throw new Error(`Failed to get scraping analytics: ${error.message}`);
    }
  }

  /**
   * Get automation analytics
   */
  async getAutomationAnalytics(filter: DateRangeFilter = {}): Promise<AutomationAnalytics> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const [
        totalRuns,
        successfulRuns,
        failedRuns,
        totalLeadsGenerated,
        exportsGenerated,
      ] = await Promise.all([
        AutomationHistory.countDocuments(dateQuery),
        AutomationHistory.countDocuments({ 
          ...dateQuery,
          status: 'success',
        }),
        AutomationHistory.countDocuments({ 
          ...dateQuery,
          status: 'failed',
        }),
        AutomationHistory.aggregate([
          { $match: dateQuery },
          { $group: { _id: null, totalLeads: { $sum: '$totalLeadsGenerated' } } },
        ]),
        ExportHistory.countDocuments(dateQuery),
      ]);

      const successRate = totalRuns > 0 
        ? Math.round((successfulRuns / totalRuns) * 100) 
        : 0;

      return {
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate,
        totalLeadsGenerated: totalLeadsGenerated[0]?.totalLeads || 0,
        exportsGenerated,
      };
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get automation analytics:', error);
      throw new Error(`Failed to get automation analytics: ${error.message}`);
    }
  }

  /**
   * Get lead distribution by category
   */
  async getCategoryDistribution(filter: DateRangeFilter = {}): Promise<CategoryCount[]> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const results = await Lead.aggregate([
        { $match: dateQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]);

      return results;
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get category distribution:', error);
      throw new Error(`Failed to get category distribution: ${error.message}`);
    }
  }

  /**
   * Get leads per day chart data
   */
  async getLeadsPerDay(filter: DateRangeFilter = {}): Promise<LeadPerDay[]> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const results = await Lead.aggregate([
        { $match: dateQuery },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        { $limit: 30 },
      ]);

      return results;
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get leads per day:', error);
      throw new Error(`Failed to get leads per day: ${error.message}`);
    }
  }

  /**
   * Get qualification distribution
   */
  async getQualificationDistribution(filter: DateRangeFilter = {}): Promise<CategoryCount[]> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const results = await Lead.aggregate([
        { $match: dateQuery },
        { 
          $group: { 
            _id: '$qualificationLevel', 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } },
      ]);

      return results;
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get qualification distribution:', error);
      throw new Error(`Failed to get qualification distribution: ${error.message}`);
    }
  }

  /**
   * Get website status distribution
   */
  async getWebsiteStatusDistribution(filter: DateRangeFilter = {}): Promise<CategoryCount[]> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const results = await Lead.aggregate([
        { $match: { ...dateQuery, websiteStatus: { $ne: null } } },
        { 
          $group: { 
            _id: '$websiteStatus', 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } },
      ]);

      return results;
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get website status distribution:', error);
      throw new Error(`Failed to get website status distribution: ${error.message}`);
    }
  }

  /**
   * Get area density for heatmap — leads grouped by state/city/area with density level
   */
  async getAreaDensity(filter: DateRangeFilter = {}): Promise<AreaDensityItem[]> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const results = await Lead.aggregate([
        { $match: { ...dateQuery, searchedArea: { $exists: true, $nin: [null, ''] } } },
        {
          $group: {
            _id: {
              state: '$searchedState',
              city: '$searchedCity',
              area: '$searchedArea',
            },
            totalLeads: { $sum: 1 },
            categories: { $push: '$category' },
          },
        },
        {
          $addFields: {
            densityLevel: {
              $cond: [{ $gte: ['$totalLeads', 150] }, 'high',
                { $cond: [{ $gte: ['$totalLeads', 51] }, 'medium', 'low' ] }
              ],
            },
          },
        },
        { $sort: { totalLeads: -1 } },
      ]);

      return results.map((r) => {
        const catCount: Record<string, number> = {};
        for (const cat of (r.categories as string[]).filter(Boolean)) {
          catCount[cat] = (catCount[cat] || 0) + 1;
        }
        const topCategories = Object.entries(catCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([category, count]) => ({ category, count }));

        return {
          state: r._id.state || '',
          city: r._id.city || '',
          area: r._id.area || '',
          totalLeads: r.totalLeads,
          densityLevel: r.densityLevel as 'high' | 'medium' | 'low',
          topCategories,
        };
      });
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get area density:', error);
      throw new Error(`Failed to get area density: ${error.message}`);
    }
  }

  /**
   * Get top areas by lead count for distribution chart
   */
  async getTopAreas(filter: DateRangeFilter = {}, limit = 10): Promise<AreaDensityItem[]> {
    try {
      const density = await this.getAreaDensity(filter);
      return density.slice(0, limit);
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get top areas:', error);
      throw new Error(`Failed to get top areas: ${error.message}`);
    }
  }

  /**
   * Get top locations by lead count
   */
  async getTopLocations(filter: DateRangeFilter = {}): Promise<CategoryCount[]> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      const results = await Lead.aggregate([
        { $match: dateQuery },
        { 
          $group: { 
            _id: '$address', 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      return results;
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get top locations:', error);
      throw new Error(`Failed to get top locations: ${error.message}`);
    }
  }

  /**
   * Get highest scoring businesses
   */
  async getHighestScoringBusinesses(filter: DateRangeFilter = {}, limit: number = 10): Promise<Record<string, unknown>[]> {
    try {
      const dateQuery = this.getDateRangeQuery(filter);

      return await Lead.find(dateQuery, {
        companyName: 1, website: 1, category: 1, source: 1, leadScore: 1,
        rating: 1, email: 1, phone: 1, searchedState: 1, searchedCity: 1,
      })
        .sort({ leadScore: -1, rating: -1 })
        .limit(limit)
        .lean();
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get highest scoring businesses:', error);
      throw new Error(`Failed to get highest scoring businesses: ${error.message}`);
    }
  }

  /**
   * Get recent scraping history
   */
  async getRecentScrapingHistory(limit: number = 10): Promise<Record<string, unknown>[]> {
    try {
      return await Lead.find({ source: 'google-maps' }, {
        companyName: 1, website: 1, category: 1, source: 1, email: 1,
        phone: 1, searchedState: 1, searchedCity: 1, createdAt: 1,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (error: any) {
      logger.error('AnalyticsService: Failed to get recent scraping history:', error);
      throw new Error(`Failed to get recent scraping history: ${error.message}`);
    }
  }

  /**
   * Get date range query for MongoDB
   */
  private getDateRangeQuery(filter: DateRangeFilter): Record<string, any> {
    const query: Record<string, any> = {};

    if (filter.startDate && filter.endDate) {
      query.createdAt = { $gte: filter.startDate, $lte: filter.endDate };
    } else if (filter.startDate) {
      query.createdAt = { $gte: filter.startDate };
    } else if (filter.endDate) {
      query.createdAt = { $lte: filter.endDate };
    }

    return query;
  }
}

export const analyticsService = new AnalyticsService();
