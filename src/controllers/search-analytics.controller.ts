import { Request, Response, NextFunction } from 'express';
import { SearchAnalytics } from '../models/SearchAnalytics';
import { APIResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cache.service';

export class SearchAnalyticsController {
  async getBySessionId(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const cacheKey = `analytics:session:${sessionId}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        APIResponse.success(res, cached);
        return;
      }
      
      const analytics = await SearchAnalytics.findOne({ sessionId }).lean();
      if (!analytics) {
        res.status(404).json({ success: false, message: 'Search analytics not found' });
        return;
      }
      
      await cacheService.set(cacheKey, analytics, 300000); // 5 min TTL
      APIResponse.success(res, analytics);
      APIResponse.success(res, analytics);
    } catch (error) {
      logger.error({ error }, '[SearchAnalytics] Error getting session analytics');
      APIResponse.error(res, 'Failed to get search analytics');
    }
  }

  async getByKeyword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { keyword } = req.query;
      const limit = parseInt(req.query.limit?.toString() || '5', 10);
      const query: Record<string, unknown> = {};
      if (keyword) query.keyword = { $regex: keyword, $options: 'i' };

      const cacheKey = `analytics:keyword:${keyword || ''}:${limit}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        APIResponse.success(res, cached);
        return;
      }

      const analytics = await SearchAnalytics.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      await cacheService.set(cacheKey, analytics, 300000); // 5 min TTL
      APIResponse.success(res, analytics);
    } catch (error) {
      logger.error({ error }, '[SearchAnalytics] Error getting keyword analytics');
      APIResponse.error(res, 'Failed to get search analytics');
    }
  }

  async getRecent(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit?.toString() || '10', 10);
      const cacheKey = `analytics:recent:${limit}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        APIResponse.success(res, cached);
        return;
      }

      const analytics = await SearchAnalytics.find({ status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      await cacheService.set(cacheKey, analytics, 60000); // 1 min TTL
      APIResponse.success(res, analytics);
    } catch (error) {
      logger.error({ error }, '[SearchAnalytics] Error getting recent analytics');
      APIResponse.error(res, 'Failed to get recent searches');
    }
  }
}

export const searchAnalyticsController = new SearchAnalyticsController();
