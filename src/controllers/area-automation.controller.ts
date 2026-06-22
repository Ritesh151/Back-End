import { Request, Response, NextFunction } from 'express';
import { areaAutomationEngine } from '../automation/area-automation-engine';
import { areaIterator } from '../automation/area-iterator';
import { APIResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class AreaAutomationController {
  async getLocationData(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const state = req.query.state as string | undefined;
      const city = req.query.city as string | undefined;

      if (state && city) {
        const areas = areaIterator.getAreas(state, city);
        APIResponse.success(res, { state, city, areas }, 'Areas fetched');
        return;
      }

      if (state) {
        const cities = areaIterator.getCities(state);
        APIResponse.success(res, { state, cities }, 'Cities fetched');
        return;
      }

      const allStates = ['Gujarat'];
      APIResponse.success(res, { states: allStates }, 'States fetched');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: getLocationData failed');
      APIResponse.error(res, 'Failed to fetch location data');
    }
  }

  async startAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { businessTypes, state, cities, sources, name, maxLeads, concurrency, retryEnabled, dedupEnabled, aiAuditEnabled, autoOutreach, autoReport, autoWhatsApp, schedule, frequency, saveAsDraft } = req.body;

      if (saveAsDraft) {
        const session = await areaAutomationEngine.saveDraft(req.body);
        APIResponse.success(res, session, 'Draft automation saved', 201);
        return;
      }

      if (!businessTypes || !Array.isArray(businessTypes) || businessTypes.length === 0) {
        APIResponse.error(res, 'At least one business type is required');
        return;
      }
      if (!state) {
        APIResponse.error(res, 'State is required');
        return;
      }
      if (!cities || !Array.isArray(cities) || cities.length === 0) {
        APIResponse.error(res, 'At least one city is required');
        return;
      }

      const cleanBusinessTypes = [...new Set(
        businessTypes
          .map((b: string) => b.trim())
          .filter((b: string) => b.length > 0)
      )];

      if (cleanBusinessTypes.length === 0) {
        APIResponse.error(res, 'Valid business types are required');
        return;
      }

      const session = await areaAutomationEngine.startAutomation({
        businessTypes: cleanBusinessTypes,
        state,
        cities,
        sources: sources || ['google-maps', 'justdial', 'indiamart'],
        name,
        maxLeads,
        concurrency,
        retryEnabled,
        dedupEnabled,
        aiAuditEnabled,
        autoOutreach,
        autoReport,
        autoWhatsApp,
        schedule,
        frequency,
      });

      APIResponse.success(res, session, 'Automation started successfully', 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: message }, 'AreaAutomation: startAutomation failed');
      APIResponse.error(res, `Failed to start automation: ${message}`);
    }
  }

  async listSessions(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { status, search, source, state, city, sortBy, sortOrder, limit, offset } = req.query;

      const result = await areaAutomationEngine.getSessionsWithFilters({
        status: status as string | undefined,
        search: search as string | undefined,
        source: source as string | undefined,
        state: state as string | undefined,
        city: city as string | undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
        limit: parseInt(limit as string, 10) || 10,
        offset: parseInt(offset as string, 10) || 0,
      });

      APIResponse.success(res, result, 'Sessions fetched');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: listSessions failed');
      APIResponse.error(res, 'Failed to fetch sessions');
    }
  }

  async getSession(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const progress = await areaAutomationEngine.getProgress(sessionId);

      if (!progress) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }

      APIResponse.success(res, progress, 'Session progress fetched');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: getSession failed');
      APIResponse.error(res, 'Failed to fetch session');
    }
  }

  async getSessionSummary(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.getSession(sessionId);

      if (!session) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }

      APIResponse.success(res, session, 'Session fetched');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: getSessionSummary failed');
      APIResponse.error(res, 'Failed to fetch session');
    }
  }

  async getJobs(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { status, businessType, city } = req.query;
      const jobs = await areaAutomationEngine.getJobs(
        sessionId,
        status as string | undefined,
        businessType as string | undefined,
        city as string | undefined
      );
      APIResponse.success(res, jobs, 'Jobs fetched');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: getJobs failed');
      APIResponse.error(res, 'Failed to fetch jobs');
    }
  }

  async updateSession(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.updateSession(sessionId, req.body);

      if (!session) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }

      APIResponse.success(res, session, 'Automation updated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: message }, 'AreaAutomation: updateSession failed');
      APIResponse.error(res, `Failed to update automation: ${message}`);
    }
  }

  async deleteSession(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const deleted = await areaAutomationEngine.deleteSession(sessionId);

      if (!deleted) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }

      APIResponse.success(res, null, 'Automation deleted successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: message }, 'AreaAutomation: deleteSession failed');
      APIResponse.error(res, `Failed to delete automation: ${message}`);
    }
  }

  async stopAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.stopAutomation(sessionId);
      if (!session) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }
      APIResponse.success(res, session, 'Automation stopped');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: stopAutomation failed');
      APIResponse.error(res, 'Failed to stop automation');
    }
  }

  async pauseAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.pauseAutomation(sessionId);
      if (!session) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }
      APIResponse.success(res, session, 'Automation paused');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: pauseAutomation failed');
      APIResponse.error(res, 'Failed to pause automation');
    }
  }

  async resumeAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.resumeAutomation(sessionId);
      APIResponse.success(res, session, 'Automation resumed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: message }, 'AreaAutomation: resumeAutomation failed');
      APIResponse.error(res, `Failed to resume automation: ${message}`);
    }
  }

  async restartAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.restartAutomation(sessionId);
      if (!session) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }
      APIResponse.success(res, session, 'Automation restarted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: message }, 'AreaAutomation: restartAutomation failed');
      APIResponse.error(res, `Failed to restart automation: ${message}`);
    }
  }

  async duplicateAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.duplicateSession(sessionId);
      if (!session) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }
      APIResponse.success(res, session, 'Automation duplicated', 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: message }, 'AreaAutomation: duplicateAutomation failed');
      APIResponse.error(res, `Failed to duplicate automation: ${message}`);
    }
  }

  async archiveAutomation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await areaAutomationEngine.archiveSession(sessionId);
      if (!session) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }
      APIResponse.success(res, session, 'Automation archived');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: message }, 'AreaAutomation: archiveAutomation failed');
      APIResponse.error(res, `Failed to archive automation: ${message}`);
    }
  }

  async getStats(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const stats = await areaAutomationEngine.getStats();
      APIResponse.success(res, stats, 'Stats fetched');
    } catch (error) {
      logger.error({ err: error }, 'AreaAutomation: getStats failed');
      APIResponse.error(res, 'Failed to fetch stats');
    }
  }
}

export const areaAutomationController = new AreaAutomationController();
