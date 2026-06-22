import { Router } from 'express';
import { monitorController } from './monitor.controller';

const router = Router();

router.get('/:sessionId/logs', (req, res, next) => monitorController.getLogs(req, res, next));
router.get('/:sessionId/live', (req, res, next) => monitorController.getLiveStatus(req, res, next));
router.get('/:sessionId/stats', (req, res, next) => monitorController.getStats(req, res, next));
router.get('/:sessionId/memory-logs', (req, res, next) => monitorController.getMemoryLogs(req, res, next));
router.delete('/:sessionId/memory-logs', (req, res, next) => monitorController.clearMemoryLogs(req, res, next));

export default router;
