import { Request, Response, NextFunction } from 'express';
import { ScraperService, ScrapeOptions } from '../services/scraper.service';
import { LeadService } from '../services/lead.service';
import { LeadQualificationService } from '../services/lead-qualification.service';
import { WebsiteAnalyzerService } from '../services/website-analyzer.service';
import { leadAuditTriggerService } from '../services/lead-audit-trigger.service';
import { leadAuditProcessor } from '../services/lead-audit-processor.service';
import { leadMigrationService } from '../services/lead-migration.service';
import { leadFilterService } from '../modules/leads/services/leadFilter.service';
import { leadStatisticsService } from '../services/lead-statistics.service';
import { Lead } from '../models/Lead';
import { SearchAnalytics } from '../models/SearchAnalytics';
import { websiteAnalysisService } from '../services/website-analysis.service';
import { searchStatus } from '../services/search-status.service';
import { APIResponse } from '../utils/api-response';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';
import {
  AnalyzeRequest,
  BulkAnalyzeRequest,
} from '../types/analysis.types';
import { semanticSearchService } from '../services/semantic-search.service';

export class LeadController {
  private scraperService: ScraperService;
  private leadService: LeadService;
  private leadQualificationService: LeadQualificationService;
  private websiteAnalyzerService: WebsiteAnalyzerService;

  constructor() {
    this.scraperService = new ScraperService();
    this.leadService = new LeadService();
    this.leadQualificationService = new LeadQualificationService();
    this.websiteAnalyzerService = new WebsiteAnalyzerService();
  }

  async searchLeads(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { keyword, location, state, city, area, sources, limit, businessType, sessionId } = req.body;

      if (!keyword) {
        res.status(400).json({
          success: false,
          message: 'Keyword is required',
          error: { keyword: 'missing' },
        });
        return;
      }

      // Build location string from state/city/area or use plain location
      let locationString = location || '';
      if (state && city) {
        locationString = area 
          ? `${area}, ${city}, ${state}`
          : `${city}, ${state}`;
      }

      const useSemantic = req.body.semanticExpansion !== false;

      const options: ScrapeOptions & { semanticKeyword?: string } = {
        keyword,
        location: locationString,
        sources: sources || ['google-maps'],
        limit: limit ? parseInt(limit.toString(), 10) : 1000,
        state,
        city,
        area,
        businessType: businessType || keyword,
        sessionId,
        semanticExpansion: useSemantic,
        semanticKeyword: req.body.semanticKeyword,
      };

      const startedAt = Date.now();
      logger.info({ 
        keyword: options.keyword, 
        location: options.location, 
        state,
        city,
        area,
        sources: options.sources, 
        limit: options.limit 
      }, '[search] request received');
      const result = await this.scraperService.scrapeBusinesses(options);
      const hasStoredData = result.totalStored > 0;
      logger.info({
        extracted: result.totalExtracted, stored: result.totalStored,
        duplicates: result.totalDuplicates, success: result.success,
        hasStoredData, durationMs: Date.now() - startedAt,
      }, '[search] scraper completed');

      // IMPORTANT: succeed if ANY leads were stored in MongoDB, even if the
      // scraper encountered partial errors. MongoDB is the source of truth.
      const leads = result.leads || [];
      const count = leads.length;
      const apiSuccess = result.success || hasStoredData;
      const pagination = {
        page: 1,
        limit: options.limit,
        total: count,
        totalPages: Math.max(1, Math.ceil((count || 1) / options.limit)),
      };

      const sourceCounts: Record<string, number> = {};
      if (result.results) {
        for (const [src, res] of Object.entries(result.results)) {
          sourceCounts[src] = res.totalStored || 0;
        }
      }

      let semanticInfo;
      if (useSemantic) {
        try {
          semanticInfo = semanticSearchService.getSearchCoverageReport(
            options.keyword,
            options.sources || ['google-maps'],
            state,
            city,
            area
          );
        } catch {
          semanticInfo = undefined;
        }
      }

      if (res.headersSent) { return; }

      try {
        if (!apiSuccess && result.totalExtracted === 0) {
          res.status(200).json({
            success: true,
            message: result.message || 'No leads found',
            count: 0,
            data: [],
            leads: [],
            pagination: { ...pagination, total: 0, totalPages: 0 },
            searchQuery: options.keyword,
            sources: sourceCounts,
            totalUniqueLeads: 0,
            semanticInfo,
            meta: {
              extracted: result.totalExtracted,
              stored: result.totalStored,
              duplicates: result.totalDuplicates,
              durationMs: Date.now() - startedAt,
            },
          });
          return;
        }

        if (res.headersSent) { return; }

        try {
        const expandedKeywords = semanticInfo?.expandedKeywordsPreview || [];
        const keywordBreakdown: Record<string, number> = {};
        if (expandedKeywords.length > 0) {
          const perKeyword = Math.max(1, Math.floor(count / expandedKeywords.length));
          expandedKeywords.forEach(kw => { keywordBreakdown[kw] = perKeyword; });
          keywordBreakdown[options.keyword] = count - (perKeyword * expandedKeywords.length);
        }

        await SearchAnalytics.findOneAndUpdate(
          { sessionId: options.sessionId || '' },
          {
            $set: {
              sessionId: options.sessionId || '',
              keyword: options.keyword,
              expandedKeywords,
              state: options.state,
              city: options.city,
              area: options.area,
              location: options.location || '',
              sources: options.sources || [],
              totalLeadsFound: result.totalExtracted || 0,
              totalUniqueLeads: count,
              totalDuplicatesRemoved: result.totalDuplicates || 0,
              sourceBreakdown: sourceCounts,
              keywordBreakdown,
              status: 'completed',
              duration: Date.now() - startedAt,
              completedAt: new Date(),
            },
          },
          { upsert: true }
        );

        if (options.sessionId) {
          searchStatus.updateUniqueLeads(options.sessionId, count);
          searchStatus.updateDuplicatesRemoved(options.sessionId, result.totalDuplicates || 0);
          for (const [src, srcCount] of Object.entries(sourceCounts)) {
            searchStatus.updateSourceBreakdown(options.sessionId, src, srcCount);
          }
          for (const [kw, kwCount] of Object.entries(keywordBreakdown)) {
            searchStatus.updateKeywordBreakdown(options.sessionId, kw, kwCount);
          }
        }
      } catch (analyticsError) {
        logger.error({ analyticsError }, '[search] Failed to store analytics');
      }

      logger.info({ count, durationMs: Date.now() - startedAt, apiSuccess }, '[search] API response');
        res.status(200).json({
          success: true,
          message: hasStoredData
            ? `Leads scraped successfully: ${count} saved`
            : (result.message || 'Scraping completed'),
          count,
          data: leads,
          leads,
          pagination,
          searchQuery: options.keyword,
          sources: sourceCounts,
          totalUniqueLeads: count,
          semanticInfo,
          meta: {
            extracted: result.totalExtracted,
            stored: result.totalStored,
            duplicates: result.totalDuplicates,
            durationMs: Date.now() - startedAt,
          },
        });
      } catch {
        if (!res.headersSent) {
          res.status(200).json({
            success: true,
            message: hasStoredData ? `Leads scraped successfully: ${count} saved` : 'Search completed',
            count,
            data: leads,
            leads,
            pagination,
            searchQuery: options.keyword,
          });
        }
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const errStack = error instanceof Error ? error.stack : undefined;
      logger.error({ err: errMsg, stack: errStack, keyword: req.body?.keyword }, '[search] Error in searchLeads');
      if (res.headersSent) { return; }
      res.status(500).json({
        success: false,
        message: `Search failed: ${errMsg}`,
      });
    }
  }

  async getLeadStatistics(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const cachedStats = cacheService.get<Record<string, number>>('leadStatistics');
      if (cachedStats) {
        res.status(200).json({ success: true, data: cachedStats });
        return;
      }

      const stats = await leadStatisticsService.getLeadStatistics();

      const data = {
        totalLeads: stats.totalLeads,
        websiteCount: stats.websiteCount,
        noWebsiteCount: stats.noWebsiteCount,
        withPhoneCount: stats.withPhoneCount,
        withoutPhoneCount: stats.withoutPhoneCount,
        pendingCount: stats.pendingCount,
        preparedCount: stats.preparedCount,
        sentCount: stats.sentCount,
        skippedCount: stats.skippedCount,
        failedCount: stats.failedCount,
      };

      cacheService.set('leadStatistics', data, 10000);

      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const errStack = error instanceof Error ? error.stack : undefined;
      logger.error({ err: errMsg, stack: errStack }, '[getLeadStatistics] Error');
      if (res.headersSent) { return; }
      res.status(500).json({
        success: false,
        message: `Failed to fetch lead statistics: ${errMsg}`,
      });
    }
  }

  async getLeads(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page?.toString() || '1', 10);
      const limit = parseInt(req.query.limit?.toString() || '10', 10);

      const result = await leadFilterService.getFilteredLeads({
        page,
        limit,
        search: req.query.search?.toString() || req.query.keyword?.toString(),
        category: req.query.category?.toString(),
        source: req.query.source?.toString(),
        sources: req.query.sources?.toString()?.split(','),
        state: req.query.state?.toString(),
        city: req.query.city?.toString(),
        area: req.query.area?.toString(),
        businessType: req.query.businessType?.toString(),
        status: req.query.status?.toString() as any,
        quality: req.query.quality?.toString() as any,
        confidence: req.query.confidence ? parseFloat(req.query.confidence.toString()) : undefined,
        minConfidence: req.query.minConfidence ? parseFloat(req.query.minConfidence.toString()) : undefined,
        maxConfidence: req.query.maxConfidence ? parseFloat(req.query.maxConfidence.toString()) : undefined,
        hasWebsite: req.query.hasWebsite === 'true' ? true : req.query.hasWebsite === 'false' ? false : undefined,
        hasPhone: req.query.hasPhone === 'true' ? true : req.query.hasPhone === 'false' ? false : undefined,
        hasEmail: req.query.hasEmail === 'true' ? true : req.query.hasEmail === 'false' ? false : undefined,
        socialOnly: req.query.socialOnly === 'true',
        verifiedOnly: req.query.verifiedOnly === 'true',
        hasWhatsApp: req.query.hasWhatsApp === 'true' ? true : req.query.hasWhatsApp === 'false' ? false : undefined,
        validationStatus: req.query.validationStatus?.toString() as any,
        qualificationLevel: req.query.qualificationLevel?.toString() as any,
        websiteType: req.query.websiteType?.toString(),
        searchSessionId: req.query.searchSessionId?.toString(),
        sortField: req.query.sortField?.toString(),
        sortOrder: req.query.sortOrder?.toString() as any,
      });

      logger.info({ count: result.leads.length, total: result.pagination.total }, '[getLeads] API response');
      res.status(200).json({
        success: true,
        currentPage: result.pagination.page,
        totalPages: result.pagination.totalPages,
        totalLeads: result.pagination.total,
        limit: result.pagination.limit,
        data: result.leads,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const errStack = error instanceof Error ? error.stack : undefined;
      logger.error({ err: errMsg, stack: errStack }, '[getLeads] Error');
      if (res.headersSent) { return; }
      res.status(500).json({
        success: false,
        message: `Failed to fetch leads: ${errMsg}`,
      });
    }
  }

  async getFilterOptions(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const options = await leadFilterService.getFilterOptions({
        state: req.query.state?.toString(),
        city: req.query.city?.toString(),
        area: req.query.area?.toString(),
      });
      res.status(200).json({ success: true, data: options });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[getFilterOptions] Error');
      res.status(500).json({ success: false, message: `Failed to fetch filter options: ${errMsg}` });
    }
  }

  async getFilterCounts(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const category = req.query.category?.toString();
      const state = req.query.state?.toString();
      const city = req.query.city?.toString();

      const cacheKey = `filterCounts:${category || ''}:${state || ''}:${city || ''}`;
      const cached = cacheService.get<{ total: number; withWebsite: number; withPhone: number; withEmail: number; validated: number }>(cacheKey);
      if (cached) {
        res.status(200).json({ success: true, data: cached });
        return;
      }

      const baseQuery: Record<string, unknown> = {};
      if (category) baseQuery.category = { $regex: category, $options: 'i' };
      if (state) baseQuery.searchedState = { $regex: state, $options: 'i' };
      if (city) baseQuery.searchedCity = { $regex: city, $options: 'i' };

      const [total, withWebsite, withPhone, withEmail, validated] = await Promise.all([
        Lead.countDocuments(baseQuery),
        Lead.countDocuments({ ...baseQuery, website: { $exists: true, $nin: [null, ''] } }),
        Lead.countDocuments({ ...baseQuery, phone: { $exists: true, $nin: [null, ''] } }),
        Lead.countDocuments({ ...baseQuery, email: { $exists: true, $nin: [null, ''] } }),
        Lead.countDocuments({ ...baseQuery, validationStatus: 'validated' }),
      ]);

      const data = { total, withWebsite, withPhone, withEmail, validated };
      cacheService.set(cacheKey, data, 15000);

      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[getFilterCounts] Error');
      res.status(500).json({ success: false, message: `Failed to fetch filter counts: ${errMsg}` });
    }
  }

  async getLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await this.leadService.getLeadById(req.params.id);

      if (!lead) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      if (lead.website) {
        const analysis = websiteAnalysisService.analyze(lead.website);

        if (lead.analysisEligible !== analysis.analysisEligible || lead.normalizedDomain !== analysis.normalizedDomain) {
          await Lead.findByIdAndUpdate(req.params.id, {
            analysisEligible: analysis.analysisEligible,
            normalizedDomain: analysis.normalizedDomain || undefined,
            hasWebsite: analysis.hasWebsite,
            hasRealWebsite: analysis.analysisEligible,
          });
          logger.info(`[LeadController] Synced lead ${lead._id}: analysisEligible=${analysis.analysisEligible}, domain=${analysis.normalizedDomain}`);
        }
      } else if (lead.analysisEligible !== false) {
        await Lead.findByIdAndUpdate(req.params.id, {
          analysisEligible: false,
          normalizedDomain: undefined,
          hasWebsite: false,
          hasRealWebsite: false,
        });
      }

      const updatedLead = await this.leadService.getLeadById(req.params.id);
      APIResponse.success(res, updatedLead, 'Lead fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async createLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await this.leadService.createLead(req.body);

      APIResponse.success(res, lead, 'Lead created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await this.leadService.updateLead(req.params.id, req.body);

      if (!lead) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      APIResponse.success(res, lead, 'Lead updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await this.leadService.deleteLead(req.params.id);

      if (!deleted) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      APIResponse.success(res, null, 'Lead deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await this.leadService.getDistinctCategories();
      APIResponse.success(res, categories, 'Categories fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAllLeads(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.leadService.deleteAllLeads();
      APIResponse.success(res, result, 'All leads deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Analyze a single lead's website
   */
  async analyzeLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body as AnalyzeRequest;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      // Get the lead
      const lead = await this.leadService.getLeadById(leadId);

      if (!lead) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      if (!lead.website) {
        APIResponse.error(res, 'Lead has no website', null, 400);
        return;
      }

      // Analyze the website
      const leadAnalysis = await this.websiteAnalyzerService.analyzeLead(leadId, lead.website);

      // Update the lead
      lead.websiteStatus = leadAnalysis.websiteStatus;
      lead.leadScore = leadAnalysis.leadScore;
      lead.qualificationLevel = leadAnalysis.qualificationLevel;
      lead.sslEnabled = leadAnalysis.analysisData.sslEnabled;
      lead.responseTime = leadAnalysis.analysisData.responseTime;
      lead.metaTitle = leadAnalysis.analysisData.metaTitle;
      lead.metaDescription = leadAnalysis.analysisData.metaDescription;
      lead.hasContactPage = leadAnalysis.analysisData.hasContactPage;
      lead.hasSocialLinks = leadAnalysis.analysisData.hasSocialLinks;
      lead.analyzedAt = new Date(leadAnalysis.analyzedAt);

      await lead.save();

      APIResponse.success(res, lead, 'Lead analyzed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk analyze multiple leads
   */
  async bulkAnalyzeLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 50 } = req.body as BulkAnalyzeRequest;

      // Get leads with websites to analyze
      const leads = await this.leadService.getAllLeads({
        limit: 1000,
      });

      if (leads.leads.length === 0) {
        APIResponse.success(res, { totalAnalyzed: 0, results: [] }, 'No leads found');
        return;
      }

      // Filter leads with websites
      const leadsWithWebsites = leads.leads.filter((lead) => !!lead.website).slice(0, limit);

      if (leadsWithWebsites.length === 0) {
        APIResponse.success(res, { totalAnalyzed: 0, results: [] }, 'No leads with websites found');
        return;
      }

      // Get lead IDs and websites
      const leadsToAnalyze = leadsWithWebsites.map((lead) => ({
        id: lead.id,
        website: lead.website,
      }));

      // Analyze in bulk
      const result = await this.websiteAnalyzerService.analyzeBulk(leadsToAnalyze, { limit });

      // Update leads in database
      for (const analysis of result.results) {
        await this.leadService.updateLead(analysis.leadId, {
          websiteStatus: analysis.websiteStatus,
          leadScore: analysis.leadScore,
          qualificationLevel: analysis.qualificationLevel,
          sslEnabled: analysis.analysisData.sslEnabled,
          responseTime: analysis.analysisData.responseTime,
          metaTitle: analysis.analysisData.metaTitle,
          metaDescription: analysis.analysisData.metaDescription,
          hasContactPage: analysis.analysisData.hasContactPage,
          hasSocialLinks: analysis.analysisData.hasSocialLinks,
          analyzedAt: new Date(analysis.analyzedAt),
        });
      }

      APIResponse.success(res, result, 'Bulk analysis completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get qualification statistics
   */
  async getQualificationStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.leadQualificationService.getQualificationStats();

      APIResponse.success(res, stats, 'Qualification stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Re-qualify unanalyzed leads
   */
  async requalifyUnanalyzedLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 50 } = req.body;

      const result = await this.leadQualificationService.requalifyUnanalyzedLeads({ limit });

      APIResponse.success(res, result, 'Re-qualification completed');
    } catch (error) {
      next(error);
    }
  }

  async triggerLeadAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      logger.info(`[LeadController] Audit request for lead ${leadId}`);

      const result = await leadAuditTriggerService.triggerMissingAuditsForLead(leadId, false);

      logger.info(`[LeadController] Audit completed: responsive=${result.responsiveAuditStatus}, intelligence=${result.businessIntelligenceStatus}`);

      APIResponse.success(res, result, 'Audit trigger completed');
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), '[LeadController] Trigger audit error');
      next(error);
    }
  }

  async triggerBulkAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadIds } = req.body;

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        APIResponse.error(res, 'leadIds array is required', null, 400);
        return;
      }

      const results = await leadAuditTriggerService.triggerMissingAuditsForMultipleLeads(leadIds);

      APIResponse.success(res, results, 'Bulk audit trigger initiated');
    } catch (error) {
      next(error);
    }
  }

  async triggerAllMissingAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 100 } = req.body;

      const result = await leadAuditTriggerService.triggerAllMissingAudits({ limit });

      APIResponse.success(res, result, 'All missing audits triggered');
    } catch (error) {
      next(error);
    }
  }

  async reprocessAllLeads(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { Lead } = await import('../models/Lead');

      const leads = await Lead.find({
        website: { $exists: true, $nin: [null, ''] },
      })
        .select('_id website')
        .lean();

      if (leads.length === 0) {
        APIResponse.success(res, { enqueued: 0 }, 'No leads with websites found');
        return;
      }

      await leadAuditProcessor.enqueueMany(
        (leads as Array<{ _id: { toString(): string }; website: string }>).map(l => ({
          leadId: l._id.toString(),
          website: l.website,
        }))
      );

      APIResponse.success(res, {
        enqueued: leads.length,
        message: `${leads.length} leads enqueued for reprocessing`,
      }, 'Reprocess all leads initiated');
    } catch (error) {
      next(error);
    }
  }

  async reclassifyLeads(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leadMigrationService.reclassifyAllLeads();
      APIResponse.success(res, result, 'Lead URL reclassification complete');
    } catch (error) {
      next(error);
    }
  }

  async getClassificationStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await leadMigrationService.getClassificationStats();
      APIResponse.success(res, stats, 'Classification stats retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getKeywordStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { keyword, state, city, area } = req.query;

      const query: Record<string, unknown> = {};
      if (keyword) {
        query.$or = [
          { semanticKeyword: { $regex: keyword as string, $options: 'i' } },
          { searchedKeyword: { $regex: keyword as string, $options: 'i' } },
        ];
      }

      if (state) query.searchedState = { $regex: state as string, $options: 'i' };
      if (city) query.searchedCity = { $regex: city as string, $options: 'i' };
      if (area) query.searchedArea = { $regex: area as string, $options: 'i' };

      const totalLeads = await Lead.countDocuments(query);

      const [keywordCounts, sourceCounts, domainCounts] = await Promise.all([
        Lead.aggregate([
          { $match: query },
          {
            $group: {
              _id: { $ifNull: ['$semanticKeyword', { $ifNull: ['$searchedKeyword', 'unknown'] }] },
              count: { $sum: 1 },
            },
          },
        ]).allowDiskUse(true),
        Lead.aggregate([
          { $match: query },
          {
            $group: {
              _id: { $ifNull: ['$source', 'unknown'] },
              count: { $sum: 1 },
            },
          },
        ]).allowDiskUse(true),
        Lead.aggregate([
          { $match: { ...query, website: { $exists: true, $nin: [null, ''] } } },
          {
            $group: {
              _id: {
                $toLower: {
                  $arrayElemAt: [
                    { $split: [{ $ifNull: ['$website', ''] }, '//'] },
                    1,
                  ],
                },
              },
              count: { $sum: 1 },
            },
          },
        ]).allowDiskUse(true),
      ]);

      const kwMap: Record<string, number> = {};
      for (const k of keywordCounts) kwMap[k._id] = k.count;

      const srcMap: Record<string, number> = {};
      for (const s of sourceCounts) srcMap[s._id] = s.count;

      const domainMap: Record<string, number> = {};
      for (const d of domainCounts) {
        const hostname = d._id?.split('/')[0]?.split('?')[0]?.replace(/^www\./, '') || d._id;
        if (hostname) domainMap[hostname] = (domainMap[hostname] || 0) + d.count;
      }

      const classificationStats = await leadMigrationService.getClassificationStats();

      APIResponse.success(res, {
        keyword: keyword as string,
        state,
        city,
        area,
        totalLeads,
        uniqueWebsites: Object.keys(domainMap).length,
        keywordCounts: kwMap,
        sourceCounts: srcMap,
        domainCounts: domainMap,
        classificationStats,
      }, 'Keyword stats retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSearchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page?.toString() || '1', 10);
      const limit = parseInt(req.query.limit?.toString() || '10', 10);
      const search = req.query.search?.toString();
      const filterState = req.query.state?.toString();
      const filterKeyword = req.query.keyword?.toString();
      const filterDate = req.query.date?.toString();

      const conditions: Record<string, unknown>[] = [];
      if (search) {
        conditions.push({
          $or: [
            { searchedKeyword: { $regex: search, $options: 'i' } },
            { semanticKeyword: { $regex: search, $options: 'i' } },
            { searchedCity: { $regex: search, $options: 'i' } },
            { searchedState: { $regex: search, $options: 'i' } },
            { searchedArea: { $regex: search, $options: 'i' } },
          ],
        });
      }

      if (filterState) {
        conditions.push({ searchedState: { $regex: filterState, $options: 'i' } });
      }

      if (filterKeyword) {
        conditions.push({
          $or: [
            { semanticKeyword: { $regex: filterKeyword, $options: 'i' } },
            { searchedKeyword: { $regex: filterKeyword, $options: 'i' } },
          ],
        });
      }

      if (filterDate) {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);
        conditions.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
      }

      const matchStage: Record<string, unknown> = {};
      if (conditions.length > 0) matchStage.$and = conditions;

      const groupId = {
        searchedState: { $ifNull: ['$searchedState', 'Unknown'] },
        searchedCity: { $ifNull: ['$searchedCity', 'Unknown'] },
        searchedArea: { $ifNull: ['$searchedArea', 'Unknown'] },
        searchedKeyword: { $ifNull: ['$semanticKeyword', '$searchedKeyword'] },
      };

      const cacheKey = `searchHistory:${search || ''}:${filterState || ''}:${filterKeyword || ''}:${filterDate || ''}:${page}:${limit}`;
      const cached = cacheService.get<{ total: number; data: any[] }>(cacheKey);
      if (cached) {
        logger.info({ total: cached.total, page, limit }, '[getSearchHistory] Cache hit');
        const dataWithSrNo = cached.data.map((item: any, idx: number) => ({
          ...item,
          srNo: idx + 1 + (page - 1) * limit,
        }));
        res.status(200).json({
          success: true,
          data: dataWithSrNo,
          pagination: {
            page,
            limit,
            total: cached.total,
            totalPages: Math.ceil(cached.total / limit),
          },
          debug: {
            totalLeadsInDatabase: cached.total > 0 ? 'Multiple groups' : '0 groups',
          },
        });
        return;
      }

      const [countResult, dataResult] = await Promise.all([
        Lead.aggregate([
          { $match: matchStage },
          { $group: { _id: groupId } },
          { $count: 'total' },
        ]).allowDiskUse(true),
        Lead.aggregate([
          { $match: matchStage },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: groupId,
              totalLeads: { $sum: 1 },
              latestCreatedAt: { $max: '$createdAt' },
              firstCreatedAt: { $min: '$createdAt' },
            },
          },
          {
            $project: {
              _id: 0,
              state: '$_id.searchedState',
              city: '$_id.searchedCity',
              area: '$_id.searchedArea',
              keyword: '$_id.searchedKeyword',
              totalLeads: 1,
              latestSearchDate: '$latestCreatedAt',
              firstSearchDate: '$firstCreatedAt',
            },
          },
          { $sort: { latestSearchDate: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]).allowDiskUse(true),
      ]);

      const total = countResult.length > 0 ? countResult[0].total : 0;
      if (total > 0) cacheService.set(cacheKey, { total, data: dataResult }, 30000);

      const totalPages = Math.ceil(total / limit);

      // Add sr number to each result
      const dataWithSrNo = dataResult.map((item, idx) => ({
        ...item,
        srNo: idx + 1 + (page - 1) * limit,
      }));

      res.status(200).json({
        success: true,
        data: dataWithSrNo,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        debug: {
          totalLeadsInDatabase: total > 0 ? 'Multiple groups' : '0 groups',
        },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const errStack = error instanceof Error ? error.stack : '';
      logger.error(
        { err: errMsg, stack: errStack },
        '[getSearchHistory] Error aggregating search history'
      );

      const leadCount = await Lead.countDocuments({});
      logger.error(
        { totalLeadsInDB: leadCount },
        '[getSearchHistory] Total leads in database'
      );

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: `Failed to fetch search history: ${errMsg}`,
          debug: {
            error: errMsg,
          },
        });
      }
      next(error);
    }
  }
}

export const leadController = new LeadController();
