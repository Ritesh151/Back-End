import { Lead } from '../models/Lead';
import { websiteAnalysisService } from './website-analysis.service';
import { leadAuditProcessor } from './lead-audit-processor.service';
import { logger } from '../utils/logger';

interface MigrationStats {
  total: number;
  processed: number;
  classified: number;
  realWebsites: number;
  socialOnly: number;
  googleOnly: number;
  marketplaceOnly: number;
  directoryOnly: number;
  invalidUrls: number;
  noWebsite: number;
}

interface LeanLead {
  _id: { toString(): string };
  website?: string;
  socialLinks?: Record<string, unknown>;
  marketplaceLinks?: Record<string, unknown>;
  socialProfiles?: Record<string, unknown>;
}

export class LeadMigrationService {
  async reclassifyAllLeads(batchSize = 100): Promise<MigrationStats> {
    const stats: MigrationStats = {
      total: 0,
      processed: 0,
      classified: 0,
      realWebsites: 0,
      socialOnly: 0,
      googleOnly: 0,
      marketplaceOnly: 0,
      directoryOnly: 0,
      invalidUrls: 0,
      noWebsite: 0,
    };

    const totalLeads = await Lead.countDocuments({});
    stats.total = totalLeads;
    logger.info(`[LeadMigration] Starting reclassification of ${totalLeads} leads`);

    let skip = 0;
    while (skip < totalLeads) {
      const batch = await Lead.find({})
        .skip(skip)
        .limit(batchSize)
        .lean() as LeanLead[];

      if (batch.length === 0) break;

      const bulkOps: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }> = [];

      for (const lead of batch) {
        const website = lead.website;

        if (!website) {
          stats.noWebsite++;
          stats.processed++;
          const updateFields: Record<string, unknown> = {
            websiteType: 'NO_WEBSITE',
            websiteStatus: 'NO_REAL_WEBSITE',
            hasRealWebsite: false,
            hasWebsite: false,
            websitePresence: 'NO',
            detectedWebsiteType: 'UNKNOWN',
            websiteAuditAllowed: false,
            websiteClassification: 'no_website',
          };
          bulkOps.push({
            updateOne: {
              filter: { _id: lead._id },
              update: { $set: updateFields },
            },
          });
          continue;
        }

        const analysis = websiteAnalysisService.getLeadFields(website);

        const updateFields: Record<string, unknown> = {
          website: analysis.website,
          hasWebsite: analysis.hasWebsite,
          normalizedDomain: analysis.normalizedDomain,
          analysisEligible: analysis.analysisEligible,
          hasRealWebsite: analysis.hasRealWebsite,
          websiteType: analysis.websiteType,
          websiteAuditAllowed: analysis.websiteAuditAllowed,
        };

        if (analysis.analysisEligible) stats.realWebsites++;
        else if (analysis.hasWebsite) stats.socialOnly++;
        else stats.noWebsite++;

        bulkOps.push({
          updateOne: {
            filter: { _id: lead._id },
            update: { $set: updateFields },
          },
        });

        stats.classified++;
        stats.processed++;
      }

      if (bulkOps.length > 0) {
        await Lead.bulkWrite(bulkOps);
        logger.info(`[LeadMigration] Processed ${stats.processed}/${totalLeads} leads`);
      }

      skip += batchSize;
    }

    logger.info(`[LeadMigration] Migration complete: ${JSON.stringify(stats)}`);

    const leadsToReaudit = await Lead.find({
      $and: [
        { website: { $exists: true, $nin: [null, ''] } },
        { $or: [
          { hasRealWebsite: true },
          { hasRealWebsite: { $exists: false } },
        ]},
      ],
      $or: [
        { 'auditStatus.overall': { $ne: 'completed' } },
        { auditStatus: { $exists: false } },
      ],
    })
      .select('_id website')
      .lean() as LeanLead[];

    if (leadsToReaudit.length > 0) {
      logger.info(`[LeadMigration] Enqueuing ${leadsToReaudit.length} real website leads for re-audit`);
      leadAuditProcessor.enqueueMany(
        leadsToReaudit.map(l => ({
          leadId: l._id.toString(),
          website: l.website || '',
        }))
      );
    }

    return stats;
  }

  async getClassificationStats(): Promise<{
    total: number;
    withWebsite: number;
    realWebsites: number;
    socialOnly: number;
    googleOnly: number;
    marketplaceOnly: number;
    noWebsite: number;
  }> {
    const total = await Lead.countDocuments({});
    const withWebsite = await Lead.countDocuments({ website: { $exists: true, $nin: [null, ''] } });
    const realWebsites = await Lead.countDocuments({ websiteType: 'REAL_WEBSITE' });
    const socialOnly = await Lead.countDocuments({ websiteType: 'SOCIAL_PROFILE' });
    const googleOnly = await Lead.countDocuments({ websiteType: 'GOOGLE_PROFILE' });
    const marketplaceOnly = await Lead.countDocuments({ websiteType: { $in: ['MARKETPLACE_PROFILE', 'DIRECTORY_PROFILE'] } });
    const noWebsite = total - withWebsite;

    return { total, withWebsite, realWebsites, socialOnly, googleOnly, marketplaceOnly, noWebsite };
  }

  async migrateWebsiteDetectionFields(batchSize = 200): Promise<{ processed: number; updated: number }> {
    let processed = 0;
    let updated = 0;

    while (true) {
      const batch = await Lead.find({
        $or: [
          { analysisEligible: { $exists: false } },
          { normalizedDomain: { $exists: false } },
        ],
      })
        .limit(batchSize)
        .select('_id website')
        .lean();

      if (batch.length === 0) break;

      const bulkOps: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }> = [];

      for (const lead of batch) {
        const analysis = websiteAnalysisService.getLeadFields(lead.website);
        bulkOps.push({
          updateOne: {
            filter: { _id: lead._id },
            update: {
              $set: {
                hasWebsite: analysis.hasWebsite,
                hasRealWebsite: analysis.hasRealWebsite,
                normalizedDomain: analysis.normalizedDomain,
                analysisEligible: analysis.analysisEligible,
                websiteType: analysis.websiteType,
                websiteAuditAllowed: analysis.websiteAuditAllowed,
              },
            },
          },
        });
        processed++;
        updated++;
      }

      if (bulkOps.length > 0) {
        await Lead.bulkWrite(bulkOps);
      }

      if (batch.length < batchSize) break;
    }

    logger.info({ processed, updated }, '[LeadMigration] Website analysis fields migration complete');
    return { processed, updated };
  }
}

export const leadMigrationService = new LeadMigrationService();
