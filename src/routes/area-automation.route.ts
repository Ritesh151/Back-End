import { Router, Request, Response, NextFunction } from 'express';
import { areaAutomationController } from '../controllers/area-automation.controller';

const router = Router();

router.get('/locations', (req: Request, res: Response, next: NextFunction) => areaAutomationController.getLocationData(req, res, next));
router.get('/stats', (req: Request, res: Response, next: NextFunction) => areaAutomationController.getStats(req, res, next));

router.post('/start', (req: Request, res: Response, next: NextFunction) => areaAutomationController.startAutomation(req, res, next));

router.get('/', (req: Request, res: Response, next: NextFunction) => areaAutomationController.listSessions(req, res, next));
router.get('/:sessionId', (req: Request, res: Response, next: NextFunction) => areaAutomationController.getSessionSummary(req, res, next));
router.patch('/:sessionId', (req: Request, res: Response, next: NextFunction) => areaAutomationController.updateSession(req, res, next));
router.delete('/:sessionId', (req: Request, res: Response, next: NextFunction) => areaAutomationController.deleteSession(req, res, next));

router.get('/:sessionId/progress', (req: Request, res: Response, next: NextFunction) => areaAutomationController.getSession(req, res, next));
router.get('/:sessionId/jobs', (req: Request, res: Response, next: NextFunction) => areaAutomationController.getJobs(req, res, next));
router.post('/:sessionId/stop', (req: Request, res: Response, next: NextFunction) => areaAutomationController.stopAutomation(req, res, next));
router.post('/:sessionId/pause', (req: Request, res: Response, next: NextFunction) => areaAutomationController.pauseAutomation(req, res, next));
router.post('/:sessionId/resume', (req: Request, res: Response, next: NextFunction) => areaAutomationController.resumeAutomation(req, res, next));
router.post('/:sessionId/restart', (req: Request, res: Response, next: NextFunction) => areaAutomationController.restartAutomation(req, res, next));
router.post('/:sessionId/duplicate', (req: Request, res: Response, next: NextFunction) => areaAutomationController.duplicateAutomation(req, res, next));
router.post('/:sessionId/archive', (req: Request, res: Response, next: NextFunction) => areaAutomationController.archiveAutomation(req, res, next));

export default router;
