import { Router } from 'express';
import { scraperController } from '../controllers/scraper.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { scrapingProgress } from '../services/scraping-progress';

const router = Router();

router.get('/status', authenticate, scraperController.getStatus);
router.get('/metrics', authenticate, scraperController.getMetrics);
router.post('/restart', authenticate, scraperController.restart);
router.get('/sessions', authenticate, scraperController.getSessions);
router.get('/progress/:sessionId', authenticate, (req, res) => {
  const { sessionId } = req.params;
  const progress = scrapingProgress.getProgress(sessionId);
  if (!progress) {
    res.status(404).json({ success: false, message: 'Session not found' });
    return;
  }
  res.json({ success: true, data: progress });
});
router.get('/search-progress/:sessionId', authenticate, scraperController.getSearchStatus);

export default router;
