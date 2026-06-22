import { Request, Response } from 'express';
import { semanticSearchService } from '../services/semantic-search.service';
import { businessCategoryEngine } from '../modules/search/businessCategoryEngine';
import { searchCoverageService } from '../services/search-coverage.service';
import { sourceManager } from '../source-manager/source-manager';
import { searchQueryScheduler } from '../services/search-query-scheduler.service';
import { browserPool } from '../services/browser-pool.service';
import { logger } from '../utils/logger';

interface SearchGuardEntry {
  sessionId: string;
  startedAt: number;
  keyword: string;
}

const activeSearches = new Map<string, SearchGuardEntry>();

function generateSearchGuardId(req: Request): string {
  const userId = (req as any).user?.id || 'anonymous';
  const keyword = req.body?.keyword || 'unknown';
  return `search_${userId}_${keyword}`;
}

function acquireSearchGuard(req: Request): { acquired: boolean; existing?: SearchGuardEntry; guardId: string } {
  const guardId = generateSearchGuardId(req);
  const existing = activeSearches.get(guardId);

  if (existing && (Date.now() - existing.startedAt) < 300000) {
    return { acquired: false, existing, guardId };
  }

  if (existing) {
    activeSearches.delete(guardId);
  }

  activeSearches.set(guardId, {
    sessionId: req.body?.sessionId || 'unknown',
    startedAt: Date.now(),
    keyword: req.body?.keyword || 'unknown',
  });

  return { acquired: true, guardId };
}

function releaseSearchGuard(guardId: string): void {
  activeSearches.delete(guardId);
}

async function safeExecute<T>(
  fn: () => Promise<T>,
  options: { errorCode: string; logContext?: Record<string, unknown> }
): Promise<{ data: T | null; error: { errorCode: string; message: string; retryable: boolean } | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    logger.error({
      err: message,
      stack,
      errorCode: options.errorCode,
      ...options.logContext,
    }, `[SemanticSearch] ${options.errorCode}`);

    const isRetryable = !message.toLowerCase().includes('invalid')
      && !message.toLowerCase().includes('not found')
      && !message.toLowerCase().includes('validation');

    return {
      data: null,
      error: {
        errorCode: options.errorCode,
        message,
        retryable: isRetryable,
      },
    };
  }
}

export class SemanticSearchController {
  async expandKeywords(req: Request, res: Response): Promise<void> {
    const { acquired, guardId } = acquireSearchGuard(req);
    if (!acquired) {
      res.status(429).json({
        success: false,
        message: 'A search is already in progress for this keyword. Please wait for it to complete.',
        retryable: true,
      });
      return;
    }

    try {
      const keyword: string = req.body.keyword;
      const sources: string[] = req.body.sources || ['google-maps'];
      const state: string | undefined = req.body.state;
      const city: string | undefined = req.body.city;
      const area: string | undefined = req.body.area;

      const inputValidation = semanticSearchService.validateInput(keyword);
      if (inputValidation) {
        res.status(400).json({
          success: false,
          message: inputValidation,
          errorCode: 'INVALID_KEYWORD',
        });
        return;
      }

      const sourceValidation = semanticSearchService.validateSources(sources);
      if (sourceValidation) {
        res.status(400).json({
          success: false,
          message: sourceValidation,
          errorCode: 'INVALID_SOURCES',
        });
        return;
      }

      const result = semanticSearchService.expandWithAIFallback(
        keyword,
        sources,
        state,
        city,
        area
      );

      if (result.validationError) {
        res.status(400).json({
          success: false,
          message: result.validationError,
          errorCode: 'EXPANSION_FAILED',
        });
        return;
      }

      const preview = {
        originalKeyword: keyword,
        matchedCategory: result.matchedCategory,
        expandedKeywords: result.expandedKeywords.map(ek => ({
          keyword: ek.keyword,
          isPrimary: ek.isPrimary,
          priority: ek.priority,
          categoryGroup: ek.categoryGroupName,
        })),
        keywordsPreview: result.expandedKeywords.slice(0, 5).map(ek => ek.keyword),
        totalExpandedKeywords: result.expandedKeywords.length,
        totalQueries: result.queries.length,
        coverage: result.coverage,
      };

      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[SemanticSearch] Error expanding keywords');
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred while expanding keywords',
        errorCode: 'INTERNAL_ERROR',
        retryable: true,
      });
    } finally {
      releaseSearchGuard(guardId);
    }
  }

  async getCategoryGroups(_req: Request, res: Response): Promise<void> {
    const result = await safeExecute(
      async () => businessCategoryEngine.getAllCategoryGroups(),
      { errorCode: 'CATEGORY_GROUPS_FAILED' }
    );

    if (result.error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve category groups',
        errorCode: result.error.errorCode,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  }

  async getSearchCoverageAnalytics(_req: Request, res: Response): Promise<void> {
    const result = await safeExecute(
      async () => searchCoverageService.getAggregateStats(),
      { errorCode: 'COVERAGE_ANALYTICS_FAILED' }
    );

    if (result.error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve search coverage analytics',
        errorCode: result.error.errorCode,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  }

  getSessionCoverage(req: Request, res: Response): void {
    try {
      const sessionId: string = req.params.sessionId;
      const session = searchCoverageService.getSession(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
          errorCode: 'SESSION_NOT_FOUND',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: session,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg, sessionId: req.params.sessionId }, '[SemanticSearch] Error getting session');
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred while retrieving the session',
        errorCode: 'INTERNAL_ERROR',
      });
    }
  }

  getSearchStatus(_req: Request, res: Response): void {
    const schedulerStatus = searchQueryScheduler.getStatus();
    const browserPoolStatus = browserPool.getStatus();
    const isActive = sourceManager.isSearchActive();

    res.status(200).json({
      success: true,
      data: {
        activeSearch: isActive,
        scheduler: schedulerStatus,
        browserPool: browserPoolStatus,
        activeSearchGuardCount: activeSearches.size,
      },
    });
  }
}

export const semanticSearchController = new SemanticSearchController();
