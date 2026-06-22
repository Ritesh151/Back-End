import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';

export class LeadFiltersController {
  async getStates(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const states = await Lead.distinct('searchedState', {
        searchedState: { $exists: true, $nin: [null, ''] },
      }).sort();

      logger.info(`[LeadFilters] States count: ${states.length}`);
      res.status(200).json({
        success: true,
        data: states,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[LeadFilters] Failed to get states');
      res.status(500).json({
        success: false,
        message: `Failed to fetch states: ${errMsg}`,
      });
    }
  }

  async getCities(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { state } = req.query;

      if (!state || typeof state !== 'string') {
        res.status(400).json({
          success: false,
          message: 'State parameter is required',
        });
        return;
      }

      const cities = await Lead.distinct('searchedCity', {
        searchedState: state,
        searchedCity: { $exists: true, $nin: [null, ''] },
      }).sort();

      logger.info(`[LeadFilters] Cities for ${state}: ${cities.length}`);
      res.status(200).json({
        success: true,
        data: cities,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg, state: req.query.state }, '[LeadFilters] Failed to get cities');
      res.status(500).json({
        success: false,
        message: `Failed to fetch cities: ${errMsg}`,
      });
    }
  }

  async getAreas(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { city, state } = req.query;

      if (!city || typeof city !== 'string') {
        res.status(400).json({
          success: false,
          message: 'City parameter is required',
        });
        return;
      }

      const areasQuery: Record<string, unknown> = {
        searchedCity: city,
        searchedArea: { $exists: true, $nin: [null, ''] },
      };

      if (state && typeof state === 'string') {
        areasQuery.searchedState = state;
      }

      const areas = await Lead.distinct('searchedArea', areasQuery).sort();

      logger.info(`[LeadFilters] Areas for ${city}, ${state || 'all states'}: ${areas.length}`);
      res.status(200).json({
        success: true,
        data: areas,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg, city: req.query.city, state: req.query.state }, '[LeadFilters] Failed to get areas');
      res.status(500).json({
        success: false,
        message: `Failed to fetch areas: ${errMsg}`,
      });
    }
  }
}

export const leadFiltersController = new LeadFiltersController();
