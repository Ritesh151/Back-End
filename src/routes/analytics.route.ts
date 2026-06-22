import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/overview', authenticate, analyticsController.getOverview);
router.get('/leads', authenticate, analyticsController.getLeadAnalytics);
router.get('/scraping', authenticate, analyticsController.getScrapingAnalytics);
router.get('/automation', authenticate, analyticsController.getAutomationAnalytics);
router.get('/categories', authenticate, analyticsController.getCategoryDistribution);
router.get('/leads-per-day', authenticate, analyticsController.getLeadsPerDay);
router.get('/qualifications', authenticate, analyticsController.getQualificationDistribution);
router.get('/website-status', authenticate, analyticsController.getWebsiteStatusDistribution);
router.get('/area-density', authenticate, analyticsController.getAreaDensity);
router.get('/top-areas', authenticate, analyticsController.getTopAreas);
router.get('/top-locations', authenticate, analyticsController.getTopLocations);
router.get('/highest-scored', authenticate, analyticsController.getHighestScoringBusinesses);
router.get('/recent-scrapes', authenticate, analyticsController.getRecentScrapingHistory);

export default router;
