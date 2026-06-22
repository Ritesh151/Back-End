import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { APIResponse } from '../utils/api-response';

export class AnalyticsController {
  /**
   * Get overview analytics
   */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getOverview(filter);

      APIResponse.success(res, data, 'Overview analytics fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get lead analytics
   */
  async getLeadAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getLeadAnalytics(filter);

      APIResponse.success(res, data, 'Lead analytics fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get scraping analytics
   */
  async getScrapingAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getScrapingAnalytics(filter);

      APIResponse.success(res, data, 'Scraping analytics fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get automation analytics
   */
  async getAutomationAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getAutomationAnalytics(filter);

      APIResponse.success(res, data, 'Automation analytics fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get category distribution
   */
  async getCategoryDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getCategoryDistribution(filter);

      APIResponse.success(res, data, 'Category distribution fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get leads per day
   */
  async getLeadsPerDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getLeadsPerDay(filter);

      APIResponse.success(res, data, 'Leads per day fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get qualification distribution
   */
  async getQualificationDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getQualificationDistribution(filter);

      APIResponse.success(res, data, 'Qualification distribution fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get website status distribution
   */
  async getWebsiteStatusDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getWebsiteStatusDistribution(filter);

      APIResponse.success(res, data, 'Website status distribution fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get area density data for heatmap
   */
  async getAreaDensity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();

      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getAreaDensity(filter);

      APIResponse.success(res, data, 'Area density fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get top areas by lead count
   */
  async getTopAreas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      const limit = parseInt(req.query.limit?.toString() || '10', 10);

      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getTopAreas(filter, limit);

      APIResponse.success(res, data, 'Top areas fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get top locations
   */
  async getTopLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getTopLocations(filter);

      APIResponse.success(res, data, 'Top locations fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get highest scoring businesses
   */
  async getHighestScoringBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate?.toString();
      const endDate = req.query.endDate?.toString();
      const limit = parseInt(req.query.limit?.toString() || '10', 10);
      
      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const data = await analyticsService.getHighestScoringBusinesses(filter, limit);

      APIResponse.success(res, data, 'Highest scoring businesses fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get recent scraping history
   */
  async getRecentScrapingHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit?.toString() || '10', 10);

      const data = await analyticsService.getRecentScrapingHistory(limit);

      APIResponse.success(res, data, 'Recent scraping history fetched successfully');
    } catch (error: any) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
