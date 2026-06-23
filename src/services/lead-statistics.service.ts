import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';

export interface LeadStatistics {
  totalLeads: number;
  websiteCount: number;
  noWebsiteCount: number;
  withPhoneCount: number;
  withoutPhoneCount: number;
  pendingCount: number;
  preparedCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  mongoQuery: Record<string, unknown>;
  appliedFilters: string[];
}

export class LeadStatisticsService {
  private baseQuery: Record<string, unknown> = {};

  async getLeadStatistics(): Promise<LeadStatistics> {
    const startTime = Date.now();

    this.baseQuery = {};
    const appliedFilters: string[] = [];

    logger.info(
      { query: this.baseQuery, filters: appliedFilters },
      '[LeadStatistics] Building base query'
    );

    const [total, websiteCount, noWebsiteCount, withPhoneCount, withoutPhoneCount, statusStats] = await Promise.all([
      Lead.countDocuments(this.baseQuery),
      Lead.countDocuments({
        ...this.baseQuery,
        hasRealWebsite: true,
      }),
      Lead.countDocuments({
        ...this.baseQuery,
        $or: [
          { hasRealWebsite: { $ne: true } },
          { hasRealWebsite: { $exists: false } },
        ],
      }),
      Lead.countDocuments({
        ...this.baseQuery,
        phone: { $exists: true, $nin: [null, ''] },
      }),
      Lead.countDocuments({
        ...this.baseQuery,
        $or: [
          { phone: { $exists: false } },
          { phone: null },
          { phone: '' },
        ],
      }),
      Lead.aggregate([
        {
          $match: this.baseQuery,
        },
        {
          $group: {
            _id: { $ifNull: ['$whatsappOutreach.status', 'pending'] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusMap: Record<string, number> = {
      pending: 0,
      prepared: 0,
      manually_sent: 0,
      skipped: 0,
      failed: 0,
    };

    for (const stat of statusStats) {
      const key = stat._id as string;
      if (key in statusMap) {
        statusMap[key] = stat.count;
      }
    }

    const duration = Date.now() - startTime;

    const result: LeadStatistics = {
      totalLeads: total,
      websiteCount,
      noWebsiteCount,
      withPhoneCount,
      withoutPhoneCount,
      pendingCount: statusMap.pending,
      preparedCount: statusMap.prepared,
      sentCount: statusMap.manually_sent,
      skippedCount: statusMap.skipped,
      failedCount: statusMap.failed,
      mongoQuery: this.baseQuery,
      appliedFilters,
    };

    logger.info(
      {
        total,
        websiteCount,
        noWebsiteCount,
        withPhoneCount,
        withoutPhoneCount,
        pending: statusMap.pending,
        prepared: statusMap.prepared,
        sent: statusMap.manually_sent,
        skipped: statusMap.skipped,
        failed: statusMap.failed,
        leadCount: total,
        durationMs: duration,
        mongoQuery: this.baseQuery,
        appliedFilters,
      },
      '[LeadStatistics] Statistics calculated'
    );

    return result;
  }
}

export const leadStatisticsService = new LeadStatisticsService();
