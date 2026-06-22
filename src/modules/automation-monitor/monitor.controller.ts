import { Request, Response, NextFunction } from 'express';
import { monitorEngine } from './monitor-engine';
import { APIResponse } from '../../utils/api-response';

export class MonitorController {
  async getLogs(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit as string, 10) || 200;
      const logs = await monitorEngine.getLogs(sessionId, limit);
      APIResponse.success(res, logs, 'Execution logs fetched');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      APIResponse.error(res, `Failed to fetch logs: ${message}`);
    }
  }

  async getLiveStatus(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const status = await monitorEngine.getLiveStatus(sessionId);
      if (!status) {
        APIResponse.error(res, 'Session not found', null, 404);
        return;
      }
      APIResponse.success(res, status, 'Live status fetched');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      APIResponse.error(res, `Failed to fetch live status: ${message}`);
    }
  }

  async getStats(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const stats = await monitorEngine.getStats(sessionId);
      APIResponse.success(res, stats, 'Monitor stats fetched');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      APIResponse.error(res, `Failed to fetch stats: ${message}`);
    }
  }

  async getMemoryLogs(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const logs = monitorEngine.getMemoryLogs(sessionId);
      APIResponse.success(res, logs, 'Memory logs fetched');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      APIResponse.error(res, `Failed to fetch memory logs: ${message}`);
    }
  }

  async clearMemoryLogs(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      monitorEngine.clearMemoryLogs(sessionId);
      APIResponse.success(res, null, 'Memory logs cleared');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      APIResponse.error(res, `Failed to clear memory logs: ${message}`);
    }
  }
}

export const monitorController = new MonitorController();
