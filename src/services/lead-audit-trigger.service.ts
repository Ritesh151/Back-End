import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { responsiveAuditService } from './responsive-audit.service';
import { businessIntelligenceService } from './business-intelligence.service';
import { websiteIntelligenceService } from './website-intelligence.service';
import { websiteAnalysisService } from './website-analysis.service';
import { auditConcurrency } from './audit-concurrency.service';
import pLimit from 'p-limit';

export interface AuditTriggerResult {
  leadId: string;
  responsiveAuditTriggered: boolean;
  businessIntelligenceTriggered: boolean;
  websiteIntelligenceTriggered: boolean;
  responsiveAuditStatus?: string;
  businessIntelligenceStatus?: string;
  websiteIntelligenceStatus?: string;
  errors?: string[];
}

export class LeadAuditTriggerService {
  private readonly maxConcurrent = 1;
  private readonly limit = pLimit(this.maxConcurrent);

  async triggerMissingAuditsForLead(leadId: string, waitForCompletion: boolean = true): Promise<AuditTriggerResult> {
    const result: AuditTriggerResult = {
      leadId,
      responsiveAuditTriggered: false,
      businessIntelligenceTriggered: false,
      websiteIntelligenceTriggered: false,
      errors: [],
    };

    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        result.errors?.push('Lead not found');
        return result;
      }
      if (!lead.hasWebsite || !lead.website) {
        result.errors?.push('Lead has no website');
        return result;
      }

      const analysis = websiteAnalysisService.resolveLead(lead);
      if (!analysis.analysisEligible) {
        result.errors?.push('Lead is not analysis-eligible — skipping audits');
        return result;
      }

      const needsResponsiveAudit = !lead.responsiveAuditCompleted;
      const needsBusinessIntelligence = !lead.intelligenceCompleted;

      const tasks: Array<{ name: string; fn: () => Promise<void> }> = [];

      if (needsResponsiveAudit) {
        result.responsiveAuditTriggered = true;
        result.responsiveAuditStatus = 'queued';
        tasks.push({
          name: `responsive:${leadId}`,
          fn: async () => {
            result.responsiveAuditStatus = 'running';
            try {
              await auditConcurrency.enqueue(leadId, 'responsive-audit', () =>
                responsiveAuditService.auditLead(leadId)
              );
              result.responsiveAuditStatus = 'completed';
            } catch (error) {
              result.responsiveAuditStatus = 'failed';
              const errorMsg = error instanceof Error ? error.message : String(error);
              result.errors?.push(`Responsive audit failed: ${errorMsg}`);
            }
          },
        });
      }

      if (needsBusinessIntelligence) {
        result.businessIntelligenceTriggered = true;
        result.businessIntelligenceStatus = 'queued';
        tasks.push({
          name: `business-intel:${leadId}`,
          fn: async () => {
            result.businessIntelligenceStatus = 'running';
            try {
              await auditConcurrency.enqueue(leadId, 'business-intelligence', () =>
                businessIntelligenceService.analyzeLead(leadId)
              );
              result.businessIntelligenceStatus = 'completed';
            } catch (error) {
              result.businessIntelligenceStatus = 'failed';
              const errorMsg = error instanceof Error ? error.message : String(error);
              result.errors?.push(`Business intelligence failed: ${errorMsg}`);
            }
          },
        });
      }

      result.websiteIntelligenceTriggered = true;
      result.websiteIntelligenceStatus = 'queued';

      const executeSequentially = async () => {
        for (const task of tasks) {
          await task.fn();
        }
        result.websiteIntelligenceStatus = 'running';
        try {
          await auditConcurrency.enqueue(leadId, 'website-intelligence', () =>
            websiteIntelligenceService.analyzeLead(leadId)
          );
          result.websiteIntelligenceStatus = 'completed';
        } catch (error) {
          result.websiteIntelligenceStatus = 'failed';
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors?.push(`Website intelligence failed: ${errorMsg}`);
        }
      };

      if (waitForCompletion) {
        await executeSequentially();
        logger.info(`[LeadAuditTrigger] All audits completed for lead ${leadId}`);
      } else {
        executeSequentially().catch(err => {
          logger.error(err, `[LeadAuditTrigger] Background audit chain failed for lead ${leadId}`);
        });
      }

      return result;
    } catch (error) {
      result.errors?.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  async triggerMissingAuditsForMultipleLeads(leadIds: string[]): Promise<AuditTriggerResult[]> {
    const results = await Promise.all(
      leadIds.map(leadId =>
        this.limit(async () => {
          try {
            return await this.triggerMissingAuditsForLead(leadId);
          } catch (error) {
            return {
              leadId,
              responsiveAuditTriggered: false,
              businessIntelligenceTriggered: false,
              websiteIntelligenceTriggered: false,
              errors: [error instanceof Error ? error.message : String(error)],
            };
          }
        })
      )
    );
    return results;
  }

  async triggerAllMissingAudits(options: { limit?: number } = {}): Promise<{
    total: number;
    responsiveAuditTriggered: number;
    businessIntelligenceTriggered: number;
    completed: number;
    failed: number;
  }> {
    const limit = options.limit || 20;

    const leads = await Lead.find({
      $and: [
        { website: { $exists: true, $nin: [null, ''] } },
        { $or: [
          { hasRealWebsite: true },
          { hasRealWebsite: { $exists: false } },
        ]},
      ],
      $or: [
        { responsiveAuditCompleted: { $ne: true } },
        { intelligenceCompleted: { $ne: true } },
      ],
    })
      .limit(limit)
      .select('_id website');

    const leadIds = leads.map(lead => lead._id.toString());
    const results = await this.triggerMissingAuditsForMultipleLeads(leadIds);

    return {
      total: results.length,
      responsiveAuditTriggered: results.filter(r => r.responsiveAuditTriggered).length,
      businessIntelligenceTriggered: results.filter(r => r.businessIntelligenceTriggered).length,
      completed: results.filter(r => !r.errors || r.errors.length === 0).length,
      failed: results.filter(r => r.errors && r.errors.length > 0).length,
    };
  }
}

export const leadAuditTriggerService = new LeadAuditTriggerService();
