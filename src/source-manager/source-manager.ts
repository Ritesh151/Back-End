import { logger } from '../utils/logger';
import { BaseSource, LeadData, SourceOptions, ScrapingResult } from '../source-core/base-source';
import { GoogleMapsSource } from '../sources/google-maps/scraper';
import { JustdialSource } from '../sources/justdial/scraper';
import { IndiaMartSource } from '../sources/indiamart/scraper';
import { ClutchSource } from '../sources/clutch/scraper';
import { scrapingProgress } from '../services/scraping-progress';
import { searchQueryBuilder, SourceQuery } from '../services/search-query-builder';
import { businessRelevanceValidator } from '../services/business-relevance-validator';
import { semanticSearchService } from '../services/semantic-search.service';
import { searchQueryScheduler } from '../services/search-query-scheduler.service';

interface ScrapeError {
  source: string;
  keyword: string;
  error: string;
  retryable: boolean;
}

export interface MultiSourceRequest {
  keyword: string;
  location?: string;
  sources: string[];
  limit: number;
  state?: string;
  city?: string;
  area?: string;
  businessType?: string;
  sessionId?: string;
  semanticExpansion?: boolean;
}

export interface MultiSourceResult {
  success: boolean;
  message: string;
  results: {
    [sourceName: string]: ScrapingResult;
  };
  totalExtracted: number;
  totalStored: number;
  totalDuplicates: number;
  leads: LeadData[];
  sourceQueries: SourceQuery[];
  partialSuccess?: boolean;
  errors?: ScrapeError[];
}

export interface SourceStatus {
  name: string;
  enabled: boolean;
  status: 'active' | 'disabled' | 'error';
  lastRun?: Date;
  successRate?: number;
}

export class SourceManager {
  private sources: Map<string, BaseSource> = new Map();
  private allLeads: LeadData[] = [];
  private errors: ScrapeError[] = [];
  private activeSearch = false;

  constructor() {
    this.registerSource(new GoogleMapsSource());
    this.registerSource(new JustdialSource());
    this.registerSource(new IndiaMartSource());
    this.registerSource(new ClutchSource());
  }

  isSearchActive(): boolean {
    return this.activeSearch;
  }

  registerSource(source: BaseSource): void {
    this.sources.set(source.getName(), source);
    logger.info(`SourceManager: Registered source: ${source.getName()}`);
  }

  unregisterSource(sourceName: string): boolean {
    return this.sources.delete(sourceName);
  }

  getSource(sourceName: string): BaseSource | undefined {
    return this.sources.get(sourceName);
  }

  getAllSources(): BaseSource[] {
    return Array.from(this.sources.values());
  }

  async scrapeMultiSource(request: MultiSourceRequest): Promise<MultiSourceResult> {
    const { keyword, location, sources, limit, state, city, area, businessType, sessionId } = request;

    this.allLeads = [];
    this.errors = [];
    this.activeSearch = true;

    const sourceQueries = searchQueryBuilder.build({
      businessType: businessType || keyword,
      state,
      city,
      area,
      sources,
    });

    logger.info({
      action: 'multi_source_started',
      keyword, area, city, state,
      sources: sources.join(', '),
      queries: sourceQueries.map(q => ({ source: q.source, url: q.url })),
    }, 'SourceManager: Starting multi-source search');

    const results: { [sourceName: string]: ScrapingResult } = {};
    let totalExtracted = 0;
    let totalStored = 0;
    let totalDuplicates = 0;

    const limitPerSource = Math.max(1, Math.floor(limit / sources.length));

    const scrapeTasks = sources.map((sourceName) =>
      searchQueryScheduler.submit({
        id: `source_${sourceName}_${Date.now()}`,
        label: `${sourceName}:${keyword}`,
        timeoutMs: 60000,
        maxRetries: 1,
        retryCount: 0,
        execute: async () => {
          const source = this.sources.get(sourceName);
          if (!source) {
            logger.warn(`SourceManager: Source not found: ${sourceName}`);
            results[sourceName] = {
              success: false,
              message: `Source not found: ${sourceName}`,
              totalExtracted: 0,
              totalStored: 0,
              totalDuplicates: 0,
              leads: [],
            };
            return;
          }

          try {
            const options: SourceOptions = {
              keyword,
              location: location || '',
              limit: limitPerSource,
              state,
              city,
              area,
              businessType: businessType || keyword,
              sessionId,
            };

            logger.info({
              action: 'source_scrape_started',
              source: sourceName,
              keyword, area, city, state,
            }, 'SourceManager: Running source');

            const result = await source.scrape(options);

            results[sourceName] = result;

            if (result.leads && result.leads.length > 0) {
              this.allLeads = [...this.allLeads, ...result.leads];
            }

            totalExtracted += result.totalExtracted;
            totalStored += result.totalStored;
            totalDuplicates += result.totalDuplicates;

            logger.info({
              action: 'source_scrape_completed',
              source: sourceName,
              totalStored: result.totalStored,
              totalExtracted: result.totalExtracted,
              totalDuplicates: result.totalDuplicates,
            }, 'SourceManager: Source completed');
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Scraping failed';
            const progress = sessionId ? scrapingProgress.getProgress(sessionId) : null;
            const partialStored = progress?.totalSaved || 0;
            logger.error({
              action: 'source_scrape_failed',
              err: message, sourceName, partialStored, sessionId,
            }, 'SourceManager: Source failed');

            this.errors.push({
              source: sourceName,
              keyword,
              error: message,
              retryable: true,
            });

            results[sourceName] = {
              success: partialStored > 0,
              message: partialStored > 0
                ? `${sourceName} completed with warnings: ${message}`
                : message,
              totalExtracted: progress?.totalFound || 0,
              totalStored: partialStored,
              totalDuplicates: 0,
              leads: [],
            };
          }
        },
      })
    );

    await Promise.allSettled(scrapeTasks);

    this.allLeads = this.allLeads.map(lead => {
      const validation = businessRelevanceValidator.validateWithAI(
        lead.companyName,
        lead.category,
        request.businessType || request.keyword,
        lead.address,
        lead.website,
        lead.phone,
        lead.email,
        lead.rating,
        lead.source,
        request.area,
        request.city,
        request.state
      );

      return {
        ...lead,
        relevanceScore: validation.relevanceScore,
        validatedCategory: validation.validatedCategory,
        locationConfidence: validation.locationConfidence,
        categoryConfidence: validation.categoryConfidence,
        finalConfidence: validation.finalConfidence,
        validationStatus: validation.validationStatus,
        rejectionReason: validation.rejectionReason,
        aiMatchType: validation.matchType,
        aiWarnings: validation.warnings,
        aiQuality: validation.quality,
        sources: lead.sources || [lead.source],
      };
    });

    const success = Object.values(results).some((r) => r.success);
    const partialSuccess = success && this.errors.length > 0;
    const message = success
      ? partialSuccess
        ? 'Scraping completed with some errors'
        : 'Scraping completed'
      : totalExtracted > 0
        ? `Found ${totalExtracted} leads but could not store them`
        : 'No leads found from any source';

    this.activeSearch = false;

    logger.info({
      action: 'multi_source_completed',
      totalStored, totalDuplicates, totalExtracted,
      sources: sources.join(', '),
      keyword, area, city, state,
      errors: this.errors.length,
    }, 'SourceManager: Multi-source search completed');

    return {
      success: success || totalExtracted > 0,
      message,
      results,
      totalExtracted,
      totalStored,
      totalDuplicates,
      leads: this.allLeads,
      sourceQueries,
      partialSuccess: partialSuccess || undefined,
      errors: this.errors.length > 0 ? this.errors : undefined,
    };
  }

  async scrapeMultiSourceSemantic(request: MultiSourceRequest): Promise<MultiSourceResult> {
    const { keyword, location: reqLocation, sources, limit, state, city, area, businessType, sessionId } = request;

    this.allLeads = [];
    this.errors = [];
    this.activeSearch = true;

    const sourceValidation = semanticSearchService.validateSources(sources);
    if (sourceValidation) {
      this.activeSearch = false;
      return {
        success: false,
        message: sourceValidation,
        results: {},
        totalExtracted: 0,
        totalStored: 0,
        totalDuplicates: 0,
        leads: [],
        sourceQueries: [],
      };
    }

    const expansionResult = semanticSearchService.expandWithAIFallback(
      businessType || keyword,
      sources,
      state,
      city,
      area
    );

    if (expansionResult.validationError) {
      this.activeSearch = false;
      return {
        success: false,
        message: expansionResult.validationError,
        results: {},
        totalExtracted: 0,
        totalStored: 0,
        totalDuplicates: 0,
        leads: [],
        sourceQueries: [],
      };
    }

    const topKeywords = expansionResult.queries.slice(0, 8);

    logger.info({
      action: 'semantic_search_started',
      originalKeyword: keyword,
      expandedKeywords: topKeywords.map(q => q.keyword),
      totalExpanded: expansionResult.queries.length,
      matchedCategory: expansionResult.matchedCategory,
      sources: sources.join(', '),
    }, 'SourceManager: Starting semantic multi-source search');

    if (sessionId) {
      const totalQueryCount = topKeywords.length * sources.length;
      scrapingProgress.createSemanticSession(sessionId, {
        keyword,
        location: reqLocation || '',
        area: area || '',
        city: city || '',
        state: state || '',
        businessType: businessType || keyword,
      }, totalQueryCount);
    }

    const allSourceQueries: SourceQuery[] = [];

    for (const sq of topKeywords) {
      const queries = searchQueryBuilder.build({
        businessType: sq.keyword,
        state,
        city,
        area,
        sources,
      });

      for (const q of queries) {
        allSourceQueries.push({
          ...q,
          semanticKeyword: sq.keyword,
          categoryGroup: sq.categoryGroupName,
          priority: sq.priority,
          isSemanticExpansion: !sq.isPrimary,
        });
      }
    }

    const results: { [sourceName: string]: ScrapingResult } = {};
    let totalExtracted = 0;
    let totalStored = 0;
    let totalDuplicates = 0;

    const limitPerQuery = Math.max(1, Math.floor(limit / Math.max(allSourceQueries.length, 1)));

    const scrapeTasks = allSourceQueries.map((sourceQuery, queryIndex) =>
      searchQueryScheduler.submit({
        id: `semantic_${sourceQuery.source}_${sourceQuery.semanticKeyword || keyword}_${Date.now()}`,
        label: `${sourceQuery.source}:${sourceQuery.semanticKeyword || keyword}`,
        timeoutMs: 60000,
        maxRetries: 1,
        retryCount: 0,
        execute: async () => {
          const source = this.sources.get(sourceQuery.source);
          if (!source) {
            if (sessionId) {
              scrapingProgress.setSemanticQuerySkipped(sessionId, queryIndex, `Source not found: ${sourceQuery.source}`);
            }
            return;
          }

          if (sessionId) {
            scrapingProgress.updateSemanticQueryProgress(sessionId, queryIndex, {
              keyword: sourceQuery.semanticKeyword || keyword,
              source: sourceQuery.source,
              status: 'running',
              startedAt: new Date().toISOString(),
            });
          }

          try {
            const options: SourceOptions = {
              keyword: sourceQuery.semanticKeyword || keyword,
              location: reqLocation || '',
              limit: limitPerQuery,
              state,
              city,
              area,
              businessType: sourceQuery.semanticKeyword || businessType || keyword,
              sessionId,
            };

            logger.info({
              action: 'semantic_source_scrape',
              source: sourceQuery.source,
              keyword: sourceQuery.semanticKeyword,
              query: sourceQuery.fullSearchQuery || sourceQuery.query,
              url: sourceQuery.url,
            }, 'SourceManager: Running semantic source query');

            const result = await source.scrape(options);

            if (result.leads && result.leads.length > 0) {
              const leadsWithMeta = result.leads.map(lead => ({
                ...lead,
                semanticCategory: sourceQuery.categoryGroup || expansionResult.matchedCategory?.id || '',
                semanticCategoryName: sourceQuery.categoryGroup || expansionResult.matchedCategory?.name || '',
                matchedKeyword: sourceQuery.semanticKeyword || keyword,
                originalSearchedKeyword: keyword,
                searchGroup: sourceQuery.categoryGroup || '',
                semanticMatchReason: sourceQuery.isSemanticExpansion
                  ? `Matched via semantic expansion: "${sourceQuery.semanticKeyword}" belongs to "${sourceQuery.categoryGroup}" category (original search: "${keyword}")`
                  : `Primary match for keyword: "${keyword}"`,
                expandedFromKeyword: sourceQuery.isSemanticExpansion ? keyword : undefined,
              }));

              this.allLeads = [...this.allLeads, ...leadsWithMeta];

              if (!results[sourceQuery.source]) {
                results[sourceQuery.source] = {
                  success: false,
                  message: '',
                  totalExtracted: 0,
                  totalStored: 0,
                  totalDuplicates: 0,
                  leads: [],
                };
              }

              results[sourceQuery.source].success = true;
              results[sourceQuery.source].totalExtracted += result.totalExtracted;
              results[sourceQuery.source].totalStored += result.totalStored;
              results[sourceQuery.source].totalDuplicates += result.totalDuplicates;
            }

            totalExtracted += result.totalExtracted;
            totalStored += result.totalStored;
            totalDuplicates += result.totalDuplicates;

            if (sessionId) {
              scrapingProgress.setSemanticQueryCompleted(sessionId, queryIndex);
            }

            logger.info({
              action: 'semantic_source_query_completed',
              source: sourceQuery.source,
              keyword: sourceQuery.semanticKeyword,
              totalStored: result.totalStored,
              totalExtracted: result.totalExtracted,
            }, 'SourceManager: Semantic source query completed');
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Scraping failed';
            logger.error({
              action: 'semantic_source_query_failed',
              err: message,
              source: sourceQuery.source,
              keyword: sourceQuery.semanticKeyword,
            }, 'SourceManager: Semantic source query failed');

            this.errors.push({
              source: sourceQuery.source,
              keyword: sourceQuery.semanticKeyword || keyword,
              error: message,
              retryable: !message.toLowerCase().includes('invalid'),
            });

            if (sessionId) {
              scrapingProgress.setSemanticQueryFailed(sessionId, queryIndex, message);
            }
          }
        },
      })
    );

    await Promise.allSettled(scrapeTasks);

    this.allLeads = this.allLeads.map(lead => {
      const validation = businessRelevanceValidator.validateWithAI(
        lead.companyName,
        lead.category,
        request.businessType || request.keyword,
        lead.address,
        lead.website,
        lead.phone,
        lead.email,
        lead.rating,
        lead.source,
        request.area,
        request.city,
        request.state
      );

      return {
        ...lead,
        relevanceScore: validation.relevanceScore,
        validatedCategory: validation.validatedCategory,
        locationConfidence: validation.locationConfidence,
        categoryConfidence: validation.categoryConfidence,
        finalConfidence: validation.finalConfidence,
        validationStatus: validation.validationStatus,
        rejectionReason: validation.rejectionReason,
        aiMatchType: validation.matchType,
        aiWarnings: validation.warnings,
        aiQuality: validation.quality,
        sources: lead.sources || [lead.source],
      };
    });

    const success = Object.values(results).some((r) => r.success);
    const partialSuccess = success && this.errors.length > 0;

    if (partialSuccess && sessionId) {
      scrapingProgress.markPartialSuccess(sessionId);
    }

    const message = success
      ? partialSuccess
        ? `Semantic search completed with some errors: ${expansionResult.queries.length} variants expanded from "${keyword}"`
        : `Semantic search completed: ${expansionResult.queries.length} variants expanded from "${keyword}"`
      : totalExtracted > 0
        ? `Found ${totalExtracted} leads but could not store them`
        : 'No leads found from any semantic variant';

    this.activeSearch = false;

    if (sessionId) {
      if (this.errors.length > 0) {
        scrapingProgress.failSession(sessionId, `${this.errors.length} semantic queries failed`);
      } else {
        scrapingProgress.completeSession(sessionId);
      }
    }

    logger.info({
      action: 'semantic_search_completed',
      originalKeyword: keyword,
      expandedKeywordsCount: topKeywords.length,
      totalStored, totalDuplicates, totalExtracted,
      matchedCategory: expansionResult.matchedCategory,
      errors: this.errors.length,
    }, 'SourceManager: Semantic search completed');

    return {
      success: success || totalExtracted > 0,
      message,
      results,
      totalExtracted,
      totalStored,
      totalDuplicates,
      leads: this.allLeads,
      sourceQueries: allSourceQueries,
      partialSuccess: partialSuccess || undefined,
      errors: this.errors.length > 0 ? this.errors : undefined,
    };
  }

  getAllLeads(): LeadData[] {
    return this.allLeads;
  }

  getSourcesStatus(): SourceStatus[] {
    return Array.from(this.sources.values()).map((source) => ({
      name: source.getName(),
      enabled: true,
      status: 'active' as const,
    }));
  }

  enableSource(sourceName: string): boolean {
    const source = this.sources.get(sourceName);
    if (source) {
      logger.info(`SourceManager: Enabled source: ${sourceName}`);
      return true;
    }
    return false;
  }

  disableSource(sourceName: string): boolean {
    const source = this.sources.get(sourceName);
    if (source) {
      logger.info(`SourceManager: Disabled source: ${sourceName}`);
      return true;
    }
    return false;
  }

  clearSearchState(): void {
    this.activeSearch = false;
    this.allLeads = [];
    this.errors = [];
  }
}

export const sourceManager = new SourceManager();
