import { Request, Response, NextFunction } from 'express';
import { sourceManager } from '../source-manager/source-manager';
import { APIResponse } from '../utils/api-response';

export class SourceController {
  /**
   * Search across multiple sources
   */
  async searchBySources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { keyword, location, sources, limit } = req.body;

      if (!keyword || !sources || sources.length === 0) {
        APIResponse.error(res, 'keyword and sources are required', null, 400);
        return;
      }

      const result = await sourceManager.scrapeMultiSource({
        keyword,
        location,
        sources,
        limit: limit || 50,
      });

      APIResponse.success(res, result, result.message, result.success ? 200 : 206);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all sources
   */
  async getSources(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sources = sourceManager.getAllSources().map((s) => ({
        name: s.getName(),
        enabled: true,
      }));

      APIResponse.success(res, sources, 'Sources fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get sources status
   */
  async getSourceStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = sourceManager.getSourcesStatus();

      APIResponse.success(res, status, 'Source status fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Enable a source
   */
  async enableSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceName } = req.params;

      const success = sourceManager.enableSource(sourceName);

      if (success) {
        APIResponse.success(res, null, `Source ${sourceName} enabled`);
      } else {
        APIResponse.error(res, 'Source not found', null, 404);
      }
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Disable a source
   */
  async disableSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceName } = req.params;

      const success = sourceManager.disableSource(sourceName);

      if (success) {
        APIResponse.success(res, null, `Source ${sourceName} disabled`);
      } else {
        APIResponse.error(res, 'Source not found', null, 404);
      }
    } catch (error: any) {
      next(error);
    }
  }
}

export const sourceController = new SourceController();
