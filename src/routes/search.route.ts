import { Router, Request, Response, NextFunction } from 'express';
import { leadController } from '../controllers/lead.controller';
import { searchRequestSchema } from '../validators/search.validator';
import { validate } from '../utils/validations';
import { asyncHandler } from '../utils/error-handler';
import { requestTimeout } from '../middlewares/timeout.middleware';
import { logger } from '../utils/logger';
import { SearchHistory } from '../models/SearchHistory';
import { Lead } from '../models/Lead';
import { APIResponse } from '../utils/api-response';
import { searchStatus } from '../services/search-status.service';

const router = Router();

async function createSearchHistoryRecord(data: {
  searchSessionId: string;
  keyword: string;
  state?: string;
  city?: string;
  area?: string;
  sources: string[];
}): Promise<void> {
  try {
    await SearchHistory.create({
      searchSessionId: data.searchSessionId,
      keyword: data.keyword,
      state: data.state,
      city: data.city,
      area: data.area,
      sources: data.sources || ['google-maps'],
      startedAt: new Date(),
      status: 'running',
      isRunning: true,
      currentFound: 0,
      currentSaved: 0,
      currentDuplicates: 0,
      failedCount: 0,
      progress: 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('E11000')) {
      logger.warn({ searchSessionId: data.searchSessionId }, '[search] SearchHistory duplicate key, skipping create');
      return;
    }
    logger.error({ err: msg }, '[search] Failed to create SearchHistory, retrying once');
    try {
      await SearchHistory.create({
        searchSessionId: data.searchSessionId,
        keyword: data.keyword,
        state: data.state,
        city: data.city,
        area: data.area,
        sources: data.sources || ['google-maps'],
        startedAt: new Date(),
        status: 'running',
        isRunning: true,
        currentFound: 0,
        currentSaved: 0,
        currentDuplicates: 0,
        failedCount: 0,
        progress: 0,
      });
    } catch (retryErr: unknown) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      if (retryMsg.includes('E11000')) {
        logger.warn({ searchSessionId: data.searchSessionId }, '[search] SearchHistory duplicate on retry, skipping');
        return;
      }
      logger.error({ err: retryMsg }, '[search] SearchHistory creation failed after retry');
      throw retryErr;
    }
  }
}

router.get(
  '/session/active',
  asyncHandler(async (_req: Request, res: Response) => {
    const session = await searchStatus.getActiveSession();
    if (!session) {
      return APIResponse.success(res, null, 'No active session');
    }
    return APIResponse.success(res, session, 'Active session found');
  })
);

router.get(
  '/active-session',
  asyncHandler(async (_req: Request, res: Response) => {
    const session = await searchStatus.getActiveSession();
    if (!session) {
      return APIResponse.success(res, null, 'No active session');
    }
    return APIResponse.success(res, session, 'Active session found');
  })
);

router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    return leadController.getSearchHistory(req, res, next);
  })
);

router.get(
  '/history/:sessionId/location-summary',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const summary = await Lead.aggregate([
      { $match: { searchSessionId: sessionId } },
      {
        $group: {
          _id: {
            state: '$searchedState',
            city: '$searchedCity',
            area: '$searchedArea',
          },
          totalLeads: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          state: { $ifNull: ['$_id.state', 'Unknown'] },
          city: { $ifNull: ['$_id.city', 'Unknown'] },
          area: { $ifNull: ['$_id.area', 'Unknown'] },
          totalLeads: 1,
        },
      },
      { $sort: { state: 1, city: 1, area: 1 } },
    ]);

    return APIResponse.success(res, summary, 'Location summary fetched');
  })
);

router.delete(
  '/history',
  asyncHandler(async (_req: Request, res: Response) => {
    await SearchHistory.deleteMany({});
    return APIResponse.success(res, null, 'Search history cleared');
  })
);

router.post(
  '/',
  requestTimeout(180000),
  validate(searchRequestSchema),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const scrapeLimit = req.body.limit || 50;

    logger.info({
      keyword: req.body.keyword,
      location: req.body.location,
      sources: req.body.sources,
      limit: scrapeLimit,
    }, '[search] Processing request');

    if (scrapeLimit > 0) {
      const sessionId = req.body.sessionId || searchStatus.generateSessionId();
      req.body.sessionId = sessionId;

      const exists = await SearchHistory.findOne({ searchSessionId: sessionId }).lean().catch(() => null);
      if (!exists) {
        await createSearchHistoryRecord({
          searchSessionId: sessionId,
          keyword: req.body.keyword,
          state: req.body.state,
          city: req.body.city,
          area: req.body.area,
          sources: req.body.sources || ['google-maps'],
        });
      }

      await leadController.searchLeads(req, res, next);
      return;
    }

    return APIResponse.success(res, {
      leads: [],
      pagination: { page: 1, limit: scrapeLimit, total: 0, totalPages: 0 },
    }, 'No leads found');
  })
);

export default router;
