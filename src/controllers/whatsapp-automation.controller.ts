import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { whatsAppAIService } from '../services/whatsapp-ai.service';
import { leadStatisticsService } from '../services/lead-statistics.service';

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('911')) return `+${digits.slice(1)}`;
  if (digits.length >= 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.startsWith('1')) return null;
  return `+${digits}`;
}

export class WhatsAppAutomationController {
  async getLeads(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page?.toString() || '1', 10);
      const limit = parseInt(req.query.limit?.toString() || '50', 10);
      const skip = (page - 1) * limit;

      const query: Record<string, unknown> = {};
      query.phone = { $exists: true, $nin: [null, ''] };

      if (req.query.search) {
        const search = req.query.search.toString();
        query.$or = [
          { companyName: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { searchedCity: { $regex: search, $options: 'i' } },
        ];
      }

      if (req.query.hasWebsite === 'true') {
        query.hasWebsite = true;
      } else if (req.query.hasWebsite === 'false') {
        query.$or = [
          ...(query.$or ? (query.$or as Record<string, unknown>[]) : []),
          { hasWebsite: false },
          { hasWebsite: { $exists: false }, hasRealWebsite: { $ne: true } },
        ];
      }

      if (req.query.reportStatus === 'generated') {
        query['report.generated'] = true;
      } else if (req.query.reportStatus === 'not_generated') {
        query['report.generated'] = { $ne: true };
      }

      if (req.query.outreachStatus) {
        const status = req.query.outreachStatus.toString();
        if (status === 'pending') {
          query.$or = [
            ...(query.$or ? (query.$or as Record<string, unknown>[]) : []),
            { 'whatsappOutreach.status': { $in: ['pending', undefined, null] } },
          ];
        } else {
          query['whatsappOutreach.status'] = status;
        }
      }

      if (req.query.city) {
        query.searchedCity = { $regex: req.query.city.toString(), $options: 'i' };
      }

      if (req.query.category) {
        query.category = { $regex: req.query.category.toString(), $options: 'i' };
      }

      if (req.query.source) {
        query.source = req.query.source.toString();
      }

      const sortOptions: Record<string, 1 | -1> = { createdAt: -1 };

      const [total, leads] = await Promise.all([
        Lead.countDocuments(query),
        Lead.find(query)
          .select('companyName phone website category searchedCity source hasRealWebsite hasWebsite websitePresence detectedWebsiteType report whatsappOutreach leadScore rating websiteType')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      const mappedLeads = leads.map((lead: Record<string, unknown>) => ({
        _id: lead._id,
        id: (lead._id as { toString(): string }).toString(),
        companyName: lead.companyName,
        phone: lead.phone,
        normalizedPhone: normalizePhone(lead.phone as string | null | undefined),
        website: lead.website,
        category: lead.category,
        city: lead.searchedCity,
        source: lead.source,
        hasWebsite: typeof lead.hasWebsite === 'boolean' ? lead.hasWebsite : false,
        websitePresence: lead.websitePresence || (lead.hasWebsite ? 'YES' : 'NO'),
        detectedWebsiteType: lead.detectedWebsiteType,
        websiteType: lead.websiteType,
        report: lead.report,
        whatsappOutreach: lead.whatsappOutreach || {
          status: 'pending', notes: '', campaignId: null,
          lastOpenedAt: null, lastSentAt: null, templateType: null,
          lastError: null, outreachAttemptCount: 0, queuePosition: null,
        },
        leadScore: lead.leadScore,
        rating: lead.rating,
        phoneValid: normalizePhone(lead.phone as string | null | undefined) !== null,
      }));

      res.status(200).json({
        success: true,
        data: mappedLeads,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppAutomation] getLeads error');
      res.status(500).json({ success: false, message: `Failed to fetch leads: ${errMsg}` });
    }
  }

  async generateMessages(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { leadIds } = req.body as { leadIds?: string[] };

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({ success: false, message: 'leadIds array is required' });
        return;
      }

      res.status(202).json({
        success: true,
        message: 'Message generation queued',
        total: leadIds.length,
      });

      setImmediate(async () => {
        try {
          const result = await whatsAppAIService.generateMessages(leadIds);
          logger.info(
            { total: result.total, skippedCount: result.skippedCount },
            '[WhatsAppAutomation] messages generated via Python AI Service'
          );
        } catch (err) {
          logger.error({ err: err instanceof Error ? err.message : String(err) }, '[WhatsAppAutomation] background message generation failed');
        }
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppAutomation] generateMessages error');
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `Failed to queue message generation: ${errMsg}` });
      }
    }
  }

  async trackOutreachAction(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { leadId, action, notes, error: actionError } = req.body as {
        leadId?: string;
        action?: 'prepared' | 'manually_sent' | 'skipped' | 'failed';
        notes?: string;
        error?: string;
      };

      if (!leadId || !action) {
        res.status(400).json({ success: false, message: 'leadId and action are required' });
        return;
      }

      const updateData: Record<string, unknown> = {
        'whatsappOutreach.status': action,
      };

      if (action === 'manually_sent') {
        updateData['whatsappOutreach.lastSentAt'] = new Date().toISOString();
        updateData['whatsappOutreach.outreachAttemptCount'] = 0;
      }

      if (action === 'failed' || actionError) {
        updateData['whatsappOutreach.lastError'] = actionError || notes || 'Unknown error';
        updateData['whatsappOutreach.outreachAttemptCount'] = 1;
      }

      if (notes) {
        updateData['whatsappOutreach.notes'] = notes;
      }

      await Lead.findByIdAndUpdate(leadId, { $set: updateData });

      logger.info({ leadId, action }, '[WhatsAppAutomation] outreach action tracked');

      res.status(200).json({ success: true, message: 'Outreach action tracked' });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppAutomation] trackOutreachAction error');
      res.status(500).json({ success: false, message: `Failed to track action: ${errMsg}` });
    }
  }

  async getStats(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const stats = await leadStatisticsService.getLeadStatistics();

      logger.info(
        {
          total: stats.totalLeads,
          withPhone: stats.withPhoneCount,
          withWebsite: stats.websiteCount,
          pending: stats.pendingCount,
          sent: stats.sentCount,
        },
        '[WhatsAppAutomation] getStats using shared statistics service'
      );

      res.status(200).json({
        success: true,
        data: {
          total: stats.totalLeads,
          withWebsite: stats.websiteCount,
          pending: stats.pendingCount,
          prepared: stats.preparedCount,
          manually_sent: stats.sentCount,
          skipped: stats.skippedCount,
          failed: stats.failedCount,
        },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppAutomation] getStats error');
      res.status(500).json({ success: false, message: `Failed to get stats: ${errMsg}` });
    }
  }

  async bulkUpdateStatus(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { leadIds, status } = req.body as {
        leadIds?: string[];
        status?: 'prepared' | 'manually_sent' | 'skipped' | 'pending' | 'failed';
      };

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0 || !status) {
        res.status(400).json({ success: false, message: 'leadIds array and status are required' });
        return;
      }

      const updateData: Record<string, unknown> = {
        'whatsappOutreach.status': status,
      };

      if (status === 'manually_sent') {
        updateData['whatsappOutreach.lastSentAt'] = new Date().toISOString();
      }

      const result = await Lead.updateMany(
        { _id: { $in: leadIds } },
        { $set: updateData }
      );

      logger.info({ modifiedCount: result.modifiedCount, status }, '[WhatsAppAutomation] bulk status update');

      res.status(200).json({
        success: true,
        message: `Updated ${result.modifiedCount} leads`,
        modifiedCount: result.modifiedCount,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppAutomation] bulkUpdateStatus error');
      res.status(500).json({ success: false, message: `Failed to bulk update: ${errMsg}` });
    }
  }
}

export const whatsAppAutomationController = new WhatsAppAutomationController();
