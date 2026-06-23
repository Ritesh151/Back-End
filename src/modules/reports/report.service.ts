import { Lead } from '../../models/Lead';
import type { ILead } from '../../models/Lead';
import { logger } from '../../utils/logger';
import type { ReportData, ReportGenerationResult } from './report.types';
import { buildAuditSummary } from './report.generator';
import { buildReportHtml } from './report.template';
import { reportPdfEngine } from './report.pdf';
import { reportStorage } from './report.storage';
import { websiteAnalysisService } from '../../services/website-analysis.service';

const REPORT_VERSION = '1.0.0';

function getDefaultReportData(): ReportData {
  return {
    generated: false,
    generating: false,
    generatedAt: null,
    reportUrl: null,
    reportPath: null,
    htmlPath: null,
    score: null,
    reportVersion: null,
    lastAuditAt: null,
    progress: null,
    failureReason: null,
  };
}

export class ReportService {
  private generationLocks: Set<string> = new Set();

  async generateReport(leadId: string): Promise<ReportGenerationResult> {
    if (this.generationLocks.has(leadId)) {
      return {
        success: false,
        reportUrl: null,
        reportPath: null,
        htmlPath: null,
        score: null,
        message: 'Report generation already in progress for this lead',
        generatedAt: new Date().toISOString(),
      };
    }

    const existingStatus = await this.getReportStatus(leadId);
    if (existingStatus.report?.generated && existingStatus.report.reportPath) {
      return {
        success: true,
        reportUrl: existingStatus.report.reportUrl,
        reportPath: existingStatus.report.reportPath,
        htmlPath: existingStatus.report.htmlPath,
        score: existingStatus.report.score,
        message: 'Report already generated',
        generatedAt: existingStatus.report.generatedAt || new Date().toISOString(),
      };
    }

    this.generationLocks.add(leadId);

    logger.info('[Report] Report Started');

    try {
      await Lead.findByIdAndUpdate(leadId, {
        'report.generating': true,
        'report.progress': { stage: 'initializing', percent: 0, message: 'Starting report generation...' },
      });

      const lead = await Lead.findById(leadId).lean() as unknown as ILead;
      if (!lead) {
        throw new Error('Lead not found');
      }

      await Lead.findByIdAndUpdate(leadId, {
        'report.progress': { stage: 'collecting_audit', percent: 15, message: 'Collecting audit data...' },
      });

      const summary = buildAuditSummary(lead);

      await Lead.findByIdAndUpdate(leadId, {
        'report.progress': { stage: 'rendering_report', percent: 40, message: 'Rendering report...' },
      });

      const html = buildReportHtml(summary);

      const htmlPath = await reportStorage.saveHtml(leadId, html);

      await Lead.findByIdAndUpdate(leadId, {
        'report.progress': { stage: 'generating_pdf', percent: 65, message: 'Generating PDF...' },
      });

      const pdfBuffer = await reportPdfEngine.generatePdf(html);
      const pdfPath = await reportStorage.savePdf(leadId, pdfBuffer);

      const reportUrl = reportStorage.getPdfUrl(pdfPath);

      const score = summary.responsiveAudit.score ?? summary.leadScore;

      await Lead.findByIdAndUpdate(leadId, {
        'report.generated': true,
        'report.generating': false,
        'report.generatedAt': new Date(),
        'report.reportUrl': reportUrl,
        'report.reportPath': pdfPath,
        'report.htmlPath': htmlPath,
        'report.score': score,
        'report.reportVersion': REPORT_VERSION,
        'report.lastAuditAt': new Date(),
        'report.progress': { stage: 'complete', percent: 100, message: 'Report generated successfully' },
        'report.failureReason': null,
      });

      logger.info({ leadId, score, reportUrl }, '[ReportService] Report generated successfully');

      return {
        success: true,
        reportUrl,
        reportPath: pdfPath,
        htmlPath,
        score,
        message: 'Report generated successfully',
        generatedAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: errMsg, leadId }, '[ReportService] Report generation failed');

      await Lead.findByIdAndUpdate(leadId, {
        'report.generated': false,
        'report.generating': false,
        'report.failureReason': errMsg,
        'report.progress': { stage: 'error', percent: 0, message: `Failed: ${errMsg}` },
      });

      return {
        success: false,
        reportUrl: null,
        reportPath: null,
        htmlPath: null,
        score: null,
        message: `Report generation failed: ${errMsg}`,
        generatedAt: new Date().toISOString(),
      };
    } finally {
      this.generationLocks.delete(leadId);
    }
  }

  async getReportStatus(leadId: string): Promise<{ exists: boolean; report: ReportData | null }> {
    const doc = await Lead.findById(leadId).select('report').lean();
    if (!doc) {
      return { exists: false, report: null };
    }
    const lead = doc as unknown as { report?: ReportData };
    return { exists: true, report: lead.report || getDefaultReportData() };
  }

  async getReportData(leadId: string): Promise<{ html: string | null; pdf: Buffer | null; report: ReportData | null }> {
    const status = await this.getReportStatus(leadId);
    if (!status.report?.generated || !status.report.htmlPath) {
      return { html: null, pdf: null, report: status.report };
    }

    const html = await reportStorage.getHtml(status.report.htmlPath);
    const pdf = status.report.reportPath ? await reportStorage.getPdf(status.report.reportPath) : null;

    return { html, pdf, report: status.report };
  }

  async deleteReport(leadId: string): Promise<boolean> {
    const status = await this.getReportStatus(leadId);
    if (!status.report) return false;

    if (status.report.reportPath) {
      await reportStorage.deleteReport(status.report.reportPath);
    }
    if (status.report.htmlPath) {
      await reportStorage.deleteReport(status.report.htmlPath);
    }

    await Lead.findByIdAndUpdate(leadId, {
      report: getDefaultReportData(),
    });

    return true;
  }

  async triggerAutoGeneration(leadId: string): Promise<void> {
    try {
      const doc = await Lead.findById(leadId).select('report website hasRealWebsite websiteType analysisEligible').lean();
      if (!doc) return;

      const lead = doc as unknown as { report?: ReportData; hasRealWebsite?: boolean; websiteType?: string; website?: string; analysisEligible?: boolean };
      if (lead.report?.generated) return;

      const analysis = lead.analysisEligible
        ? { analysisEligible: true }
        : websiteAnalysisService.resolveLead(lead);
      if (!analysis.analysisEligible) return;

      logger.info('[Report] Report Started — auto-gen queued');

      const { reportQueue } = await import('./report.queue.js');
      reportQueue.enqueue(leadId).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), leadId }, '[ReportService] Auto-generation failed');
      });
    } catch (error: unknown) {
      logger.error({ err: error instanceof Error ? error.message : String(error), leadId }, '[ReportService] Auto-generation error');
    }
  }
}

export const reportService = new ReportService();
