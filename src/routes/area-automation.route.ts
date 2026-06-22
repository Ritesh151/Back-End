import { Router } from 'express';
import { areaAutomationController } from '../controllers/area-automation.controller';

const router = Router();

router.get('/locations', (req, res, next) => areaAutomationController.getLocationData(req, res, next));
router.get('/stats', (req, res, next) => areaAutomationController.getStats(req, res, next));

router.post('/start', (req, res, next) => areaAutomationController.startAutomation(req, res, next));

router.get('/', (req, res, next) => areaAutomationController.listSessions(req, res, next));
router.get('/:sessionId', (req, res, next) => areaAutomationController.getSessionSummary(req, res, next));
router.patch('/:sessionId', (req, res, next) => areaAutomationController.updateSession(req, res, next));
router.delete('/:sessionId', (req, res, next) => areaAutomationController.deleteSession(req, res, next));

router.get('/:sessionId/progress', (req, res, next) => areaAutomationController.getSession(req, res, next));
router.get('/:sessionId/jobs', (req, res, next) => areaAutomationController.getJobs(req, res, next));
router.post('/:sessionId/stop', (req, res, next) => areaAutomationController.stopAutomation(req, res, next));
router.post('/:sessionId/pause', (req, res, next) => areaAutomationController.pauseAutomation(req, res, next));
router.post('/:sessionId/resume', (req, res, next) => areaAutomationController.resumeAutomation(req, res, next));
router.post('/:sessionId/restart', (req, res, next) => areaAutomationController.restartAutomation(req, res, next));
router.post('/:sessionId/duplicate', (req, res, next) => areaAutomationController.duplicateAutomation(req, res, next));
router.post('/:sessionId/archive', (req, res, next) => areaAutomationController.archiveAutomation(req, res, next));

export default router;
