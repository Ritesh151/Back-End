import { Router } from 'express';
import { searchAnalyticsController } from '../controllers/search-analytics.controller';

const router = Router();

router.get('/recent', searchAnalyticsController.getRecent.bind(searchAnalyticsController));
router.get('/keyword', searchAnalyticsController.getByKeyword.bind(searchAnalyticsController));
router.get('/:sessionId', searchAnalyticsController.getBySessionId.bind(searchAnalyticsController));

export default router;
