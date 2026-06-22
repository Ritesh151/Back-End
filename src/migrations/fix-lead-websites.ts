import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { websiteAnalysisService } from '../services/website-analysis.service';

export async function fixLeadWebsites(batchSize = 200): Promise<{
  total: number;
  updated: number;
  eligible: number;
  nonEligible: number;
  noWebsite: number;
}> {
  const total = await Lead.countDocuments({});
  let updated = 0;
  let eligible = 0;
  let nonEligible = 0;
  let noWebsite = 0;
  let skip = 0;

  logger.info(`[Migration] Starting fixLeadWebsites migration for ${total} leads`);

  while (skip < total) {
    const batch = await Lead.find({})
      .skip(skip)
      .limit(batchSize)
      .lean();

    if (batch.length === 0) break;

    const bulkOps: Array<{
      updateOne: {
        filter: { _id: string };
        update: Record<string, unknown>;
      };
    }> = [];

    for (const lead of batch) {
      const website = (lead as Record<string, unknown>).website as string | undefined;
      const analysis = websiteAnalysisService.getLeadFields(website);

      const updateFields: Record<string, unknown> = {
        hasWebsite: analysis.hasWebsite,
        normalizedDomain: analysis.normalizedDomain,
        analysisEligible: analysis.analysisEligible,
        hasRealWebsite: analysis.hasRealWebsite,
        websiteType: analysis.websiteType,
        websiteAuditAllowed: analysis.websiteAuditAllowed,
      };

      if (analysis.website) {
        updateFields.website = analysis.website;
      }

      if (analysis.analysisEligible) {
        eligible++;
      } else if (analysis.hasWebsite) {
        nonEligible++;
      } else {
        noWebsite++;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: (lead as Record<string, unknown>)._id as string },
          update: { $set: updateFields },
        },
      });

      updated++;
    }

    if (bulkOps.length > 0) {
      await Lead.bulkWrite(bulkOps as Parameters<typeof Lead.bulkWrite>[0]);
      logger.info(`[Migration] Processed ${updated}/${total} leads`);
    }

    skip += batchSize;
  }

  const stats = { total, updated, eligible, nonEligible, noWebsite };
  logger.info(`[Migration] fixLeadWebsites complete: ${JSON.stringify(stats)}`);

  return stats;
}
