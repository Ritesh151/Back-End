import crypto from 'crypto';
import { Lead } from '../models/Lead';
import type { ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import { responsiveAuditService } from './responsive-audit.service';
import { businessIntelligenceService } from './business-intelligence.service';
import { salesIntelligenceService } from './sales-intelligence.service';
import { outreachService } from './outreach.service';

export interface PipelineStepResult {
  step: string;
  success: boolean;
  error?: string;
}

const PIPELINE_STEPS = [
  { name: 'Responsive Audit', field: 'responsiveAuditReady' as const },
  { name: 'Business Intelligence', field: 'intelligenceReady' as const },
  { name: 'Sales Intelligence', field: 'salesAIReady' as const },
  { name: 'Outreach Generation', field: 'outreachReady' as const },
  { name: 'Report Generation', field: 'reportReady' as const },
];

function computeWebsiteHash(website: string | undefined): string {
  if (!website) return '';
  return crypto.createHash('md5').update(website.toLowerCase().trim()).digest('hex');
}

export class AIPipelineService {
  async runPipeline(leadId: string): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const lead = await Lead.findById(leadId).lean() as ILead | null;
      if (!lead) {
        return { success: false, errors: ['Lead not found'] };
      }

      if (lead.aiStatus === 'completed') {
        const currentHash = computeWebsiteHash(lead.website);
        if (currentHash && currentHash === lead.aiWebsiteHash) {
          logger.info(`[AIPipeline] Lead ${leadId} already completed with same website hash, skipping`);
          return { success: true, errors: [] };
        }
      }

      logger.info(`[AIPipeline] Starting pipeline for lead ${leadId} (${lead.companyName})`);

      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          aiStatus: 'processing',
          aiProgress: 0,
          aiCurrentStep: 'Initializing',
          aiCurrentStepIndex: 0,
          aiTotalSteps: PIPELINE_STEPS.length,
          processingStartedAt: new Date(),
          aiError: null,
        },
      });

      const totalSteps = PIPELINE_STEPS.length;

      for (let i = 0; i < totalSteps; i++) {
        const step = PIPELINE_STEPS[i];
        const progress = Math.round(((i) / totalSteps) * 100);

        try {
          await Lead.findByIdAndUpdate(leadId, {
            $set: {
              aiCurrentStep: step.name,
              aiCurrentStepIndex: i,
              aiProgress: progress,
            },
          });

          logger.info(`[AIPipeline] Step ${i + 1}/${totalSteps}: ${step.name} for lead ${leadId}`);

          switch (step.name) {
            case 'Responsive Audit':
              await responsiveAuditService.auditLead(leadId);
              await Lead.findByIdAndUpdate(leadId, {
                $set: { responsiveAuditReady: true },
              });
              break;

            case 'Business Intelligence':
              await businessIntelligenceService.analyzeLead(leadId);
              await Lead.findByIdAndUpdate(leadId, {
                $set: { intelligenceReady: true },
              });
              break;

            case 'Sales Intelligence':
              await salesIntelligenceService.analyzeLead(leadId);
              await Lead.findByIdAndUpdate(leadId, {
                $set: { salesAIReady: true },
              });
              break;

            case 'Outreach Generation':
              await outreachService.generateOutreachForLead(leadId);
              await Lead.findByIdAndUpdate(leadId, {
                $set: { outreachReady: true },
              });
              break;

            case 'Report Generation':
              try {
                const { reportService } = await import('../modules/reports/report.service.js');
                await reportService.generateReport(leadId);
              } catch (reportErr: unknown) {
                const reportMsg = reportErr instanceof Error ? reportErr.message : String(reportErr);
                logger.warn({ err: reportMsg, leadId }, '[AIPipeline] Report generation failed (non-blocking)');
              }
              await Lead.findByIdAndUpdate(leadId, {
                $set: { reportReady: true, reportGenerated: true },
              });
              break;
          }

          logger.info(`[AIPipeline] Step ${i + 1}/${totalSteps}: ${step.name} completed for lead ${leadId}`);
        } catch (stepErr: unknown) {
          const stepMsg = stepErr instanceof Error ? stepErr.message : 'Unknown error';
          const errorMsg = `Step ${i + 1} (${step.name}): ${stepMsg}`;
          errors.push(errorMsg);
          logger.warn({ err: stepMsg, leadId, step: step.name }, `[AIPipeline] Step failed (continuing): ${step.name}`);
        }
      }

      const websiteDoc = await Lead.findById(leadId).select('website').lean() as Record<string, unknown> | null;
      const finalHash = websiteDoc ? computeWebsiteHash(websiteDoc.website as string | undefined) : '';

      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          aiStatus: errors.length === PIPELINE_STEPS.length ? 'failed' : 'completed',
          aiProgress: 100,
          aiCurrentStep: errors.length > 0 ? 'Completed with errors' : 'Completed',
          processingCompletedAt: new Date(),
          lastAuditAt: new Date(),
          aiWebsiteHash: finalHash || undefined,
        },
      });

      logger.info({
        leadId,
        companyName: lead.companyName,
        totalSteps,
        errors: errors.length,
        success: errors.length < PIPELINE_STEPS.length,
      }, '[AIPipeline] Pipeline finished');

      return { success: errors.length < PIPELINE_STEPS.length, errors };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errMsg, leadId }, '[AIPipeline] Fatal pipeline error');

      try {
        await Lead.findByIdAndUpdate(leadId, {
          $set: {
            aiStatus: 'failed',
            aiError: errMsg,
            processingCompletedAt: new Date(),
          },
        });
      } catch {
        // ignore error during error handling
      }

      return { success: false, errors: [errMsg] };
    }
  }
}

export const aiPipelineService = new AIPipelineService();
