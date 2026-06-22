import { Router } from 'express';
import { sourceController } from '../controllers/source.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/search', authenticate, sourceController.searchBySources);
router.get('/', authenticate, sourceController.getSources);
router.get('/status', authenticate, sourceController.getSourceStatus);
router.patch('/enable/:sourceName', authenticate, sourceController.enableSource);
router.patch('/disable/:sourceName', authenticate, sourceController.disableSource);

export default router;
