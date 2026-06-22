import { Router } from 'express';
import { semanticSearchController } from '../controllers/semantic-search.controller';
import { asyncHandler } from '../utils/error-handler';

const router = Router();

router.post('/expand', asyncHandler(semanticSearchController.expandKeywords.bind(semanticSearchController)));
router.get('/status', asyncHandler(semanticSearchController.getSearchStatus.bind(semanticSearchController)));
router.get('/categories', asyncHandler(semanticSearchController.getCategoryGroups.bind(semanticSearchController)));
router.get('/analytics', asyncHandler(semanticSearchController.getSearchCoverageAnalytics.bind(semanticSearchController)));
router.get('/sessions/:sessionId', asyncHandler(semanticSearchController.getSessionCoverage.bind(semanticSearchController)));

export default router;
