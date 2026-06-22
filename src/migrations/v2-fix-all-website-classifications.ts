import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { classifyWebsiteUrl } from '../modules/leads/services/urlClassifier.service';

export async function fixAllWebsiteClassifications(batchSize = 200): Promise<{
  total: number;
  updated: number;
  corrected: number;
  socialProfiles: number;
  businessWebsites: number;
  noWebsite: number;
}> {
  const total = await Lead.countDocuments({});
  let updated = 0;
  let corrected = 0;
  let socialProfiles = 0;
  let businessWebsites = 0;
  let noWebsite = 0;
  let skip = 0;

  logger.info(`[v2 Migration] Starting fixAllWebsiteClassifications for ${total} leads`);

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
      const leadRecord = lead as Record<string, unknown>;
      const website = leadRecord.website as string | undefined;

      const classified = classifyWebsiteUrl(website || null);
      const hasRealWebsite = classified.hasRealWebsite;
      const oldHasWebsite = leadRecord.hasWebsite as boolean | undefined;

      const updateFields: Record<string, unknown> = {
        hasWebsite: hasRealWebsite,
        hasRealWebsite: hasRealWebsite,
        websiteType: classified.websiteType,
        websiteClassification: classified.websiteType === 'REAL_WEBSITE' ? 'business_website'
          : classified.websiteType === 'SOCIAL_PROFILE' ? 'social_profile'
          : classified.websiteType === 'GOOGLE_PROFILE' ? 'google_business_profile'
          : classified.websiteType === 'MARKETPLACE_PROFILE' || classified.websiteType === 'DIRECTORY_PROFILE' ? 'directory_listing'
          : 'no_website',
        websiteAuditAllowed: hasRealWebsite,
        analysisEligible: hasRealWebsite,
      };

      if (classified.normalizedUrl) {
        updateFields.normalizedDomain = classified.normalizedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
      } else {
        updateFields.normalizedDomain = null;
      }

      const oldIncorrect = oldHasWebsite === true && !hasRealWebsite;
      if (oldIncorrect) {
        corrected++;
      }

      if (hasRealWebsite) {
        businessWebsites++;
      } else if (classified.websiteType === 'SOCIAL_PROFILE' || classified.websiteType === 'GOOGLE_PROFILE' || classified.websiteType === 'MARKETPLACE_PROFILE' || classified.websiteType === 'DIRECTORY_PROFILE') {
        socialProfiles++;
      } else {
        noWebsite++;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: leadRecord._id as string },
          update: { $set: updateFields },
        },
      });

      updated++;
    }

    if (bulkOps.length > 0) {
      await Lead.bulkWrite(bulkOps as Parameters<typeof Lead.bulkWrite>[0]);
      logger.info(`[v2 Migration] Processed ${updated}/${total} leads (${corrected} corrections so far)`);
    }

    skip += batchSize;
  }

  const stats = { total, updated, corrected, socialProfiles, businessWebsites, noWebsite };
  logger.info(`[v2 Migration] fixAllWebsiteClassifications complete: ${JSON.stringify(stats)}`);

  return stats;
}
