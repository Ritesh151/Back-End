import { Request, Response } from 'express';
import { businessIntelligenceService } from '../services/business-intelligence.service';
import { logger } from '../utils/logger';

export class BusinessIntelligenceController {
  async analyzeSingleLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const { timeout, includeDeepAnalysis } = req.body;

      logger.info(`Business intelligence request for lead ${leadId}`);

      const lead = await businessIntelligenceService.analyzeLead(leadId, {
        timeout,
        includeDeepAnalysis,
      });

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found or analysis failed',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Business intelligence analysis completed successfully',
        data: {
          leadId: lead._id,
          trustScore: lead.trustScore,
          websiteQualityScore: lead.websiteQualityScore,
          businessOpportunity: lead.businessOpportunity,
          intelligenceCompleted: lead.intelligenceCompleted,
          analyzedAt: lead.intelligenceAnalyzedAt,
        },
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Business intelligence single lead error:');
      res.status(500).json({
        success: false,
        message: 'Failed to analyze lead',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async analyzeMultipleLeads(req: Request, res: Response): Promise<void> {
    try {
      const { leadIds, timeout, includeDeepAnalysis } = req.body;

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'leadIds array is required',
        });
        return;
      }

      logger.info(`Bulk business intelligence request for ${leadIds.length} leads`);

      const result = await businessIntelligenceService.analyzeMultipleLeads(leadIds, {
        timeout,
        includeDeepAnalysis,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Business intelligence bulk error:');
      res.status(500).json({
        success: false,
        message: 'Failed to analyze leads',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async analyzeLeadsWithoutIntelligence(req: Request, res: Response): Promise<void> {
    try {
      const { limit, timeout, includeDeepAnalysis } = req.body;

      logger.info(`Analyze leads without intelligence request (limit: ${limit || 50})`);

      const result = await businessIntelligenceService.analyzeLeadsWithoutIntelligence({
        limit,
        timeout,
        includeDeepAnalysis,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Analyze without intelligence error:');
      res.status(500).json({
        success: false,
        message: 'Failed to analyze leads',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getIntelligenceStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await businessIntelligenceService.getIntelligenceStats();

      res.status(200).json({
        success: true,
        message: 'Business intelligence statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Get intelligence stats error:');
      res.status(500).json({
        success: false,
        message: 'Failed to get business intelligence statistics',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async reanalyzeLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const { timeout, includeDeepAnalysis } = req.body;

      logger.info(`Re-analyze business intelligence request for lead ${leadId}`);

      const lead = await businessIntelligenceService.reanalyzeLead(leadId, {
        timeout,
        includeDeepAnalysis,
      });

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found or re-analysis failed',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Business intelligence re-analysis completed successfully',
        data: {
          leadId: lead._id,
          trustScore: lead.trustScore,
          websiteQualityScore: lead.websiteQualityScore,
          businessOpportunity: lead.businessOpportunity,
          intelligenceCompleted: lead.intelligenceCompleted,
          analyzedAt: lead.intelligenceAnalyzedAt,
        },
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Re-analyze lead error:');
      res.status(500).json({
        success: false,
        message: 'Failed to re-analyze lead',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const businessIntelligenceController = new BusinessIntelligenceController();
