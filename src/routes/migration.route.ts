import { Router, Request, Response } from 'express';
import { leadMigrationService } from '../services/lead-migration.service';
import { APIResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { fixAllWebsiteClassifications } from '../migrations/v2-fix-all-website-classifications';

const router = Router();

router.post('/reclassify-all', async (_req: Request, res: Response) => {
  try {
    logger.info('[Migration] Starting reclassify-all...');
    const result = await leadMigrationService.reclassifyAllLeads(100);
    APIResponse.success(res, {
      message: 'Reclassification complete',
      stats: result,
    });
  } catch (error) {
    logger.error({ error }, '[Migration] Reclassify-all failed');
    APIResponse.error(res, 'Reclassification failed');
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await leadMigrationService.getClassificationStats();
    APIResponse.success(res, stats);
  } catch (error) {
    logger.error({ error }, '[Migration] Stats fetch failed');
    APIResponse.error(res, 'Failed to get stats');
  }
});

router.post('/migrate-website-detection', async (_req: Request, res: Response) => {
  try {
    logger.info('[Migration] Starting website detection field migration...');
    const result = await leadMigrationService.migrateWebsiteDetectionFields(200);
    APIResponse.success(res, {
      message: 'Website detection migration complete',
      stats: result,
    });
  } catch (error) {
    logger.error({ error }, '[Migration] Website detection migration failed');
    APIResponse.error(res, 'Website detection migration failed');
  }
});

router.post('/v2-fix-all-websites', async (_req: Request, res: Response) => {
  try {
    logger.info('[Migration] Starting v2 website classification fix...');
    const result = await fixAllWebsiteClassifications(200);
    APIResponse.success(res, {
      message: 'v2 website classification fix complete',
      stats: result,
    });
  } catch (error) {
    logger.error({ error }, '[Migration] v2 website classification fix failed');
    APIResponse.error(res, 'v2 website classification fix failed');
  }
});

export default router;
