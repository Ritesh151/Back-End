import { Request, Response } from 'express';
import { salesIntelligenceService } from '../services/sales-intelligence.service';
import { logger } from '../utils/logger';

export class SalesIntelligenceController {
  async analyzeSingleLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;

      logger.info(`AI sales intelligence request for lead ${leadId}`);

      const lead = await salesIntelligenceService.analyzeLead(leadId);

      if (!lead) {
        res.status(404).json({ success: false, message: 'Lead not found or analysis failed' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'AI sales intelligence completed successfully',
        data: {
          leadId: lead._id,
          aiLeadScore: lead.aiLeadScore,
          salesPriority: lead.salesPriority,
          conversionProbability: lead.conversionProbability,
          aiInsight: lead.aiInsight,
          salesIntelligenceCompleted: lead.salesIntelligenceCompleted,
        },
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Sales intelligence single lead error:');
      res.status(500).json({ success: false, message: 'Failed to analyze lead', error: error instanceof Error ? error.message : String(error) });
    }
  }

  async analyzeMultipleLeads(req: Request, res: Response): Promise<void> {
    try {
      const { leadIds } = req.body;

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({ success: false, message: 'leadIds array is required' });
        return;
      }

      logger.info(`Bulk sales intelligence request for ${leadIds.length} leads`);
      const result = await salesIntelligenceService.analyzeMultipleLeads(leadIds);

      res.status(200).json({ success: true, message: result.message, data: result });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Sales intelligence bulk error:');
      res.status(500).json({ success: false, message: 'Failed to analyze leads', error: error instanceof Error ? error.message : String(error) });
    }
  }

  async analyzeLeadsWithoutAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = req.body;

      logger.info(`Analyze leads without sales intelligence (limit: ${limit || 50})`);
      const result = await salesIntelligenceService.analyzeLeadsWithoutAnalysis({ limit });

      res.status(200).json({ success: true, message: result.message, data: result });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Analyze without sales intelligence error:');
      res.status(500).json({ success: false, message: 'Failed to analyze leads', error: error instanceof Error ? error.message : String(error) });
    }
  }

  async getSalesStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await salesIntelligenceService.getSalesStats();

      res.status(200).json({ success: true, message: 'Sales intelligence statistics retrieved', data: stats });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Get sales stats error:');
      res.status(500).json({ success: false, message: 'Failed to get sales statistics', error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const salesIntelligenceController = new SalesIntelligenceController();
