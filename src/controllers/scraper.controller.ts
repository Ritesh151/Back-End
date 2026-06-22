import { Request, Response, NextFunction } from 'express';
import { scraperManager } from '../scraper-core/scraper-manager';
import { metricsService } from '../monitoring/metrics.service';
import { APIResponse } from '../utils/api-response';
import { searchStatus } from '../services/search-status.service';

export class ScraperController {
  /**
   * Get scraper status
   */
  async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = scraperManager.getStatus();
      const metrics = await metricsService.getMetrics();
      const successRate = await metricsService.getSuccessRate();

      APIResponse.success(res, {
        status,
        metrics,
        successRate,
      }, 'Scraper status fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get scraper metrics
   */
  async getMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detailedMetrics = await metricsService.getDetailedMetrics();
      APIResponse.success(res, detailedMetrics, 'Scraper metrics fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Restart scraper
   */
  async restart(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await scraperManager.restart();
      await metricsService.reset();
      APIResponse.success(res, null, 'Scraper restarted successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get active sessions
   */
  async getSessions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = scraperManager.getStatus();
      APIResponse.success(res, {
        activeSessions: status.activeSessions,
        queueLength: status.queueLength,
      }, 'Active sessions fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get search status progress
   */
  async getSearchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const progress = searchStatus.getProgress(sessionId);

      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Search session not found',
        });
        return;
      }

      res.json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const scraperController = new ScraperController();
