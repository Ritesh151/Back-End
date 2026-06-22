import { Router, Request, Response, NextFunction } from 'express';
import { whatsAppAutomationController } from '../controllers/whatsapp-automation.controller';
import { asyncHandler } from '../utils/error-handler';

const router = Router();

router.get('/leads', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppAutomationController.getLeads(req, res, next)));

router.post('/generate-messages', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppAutomationController.generateMessages(req, res, next)));

router.post('/track', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppAutomationController.trackOutreachAction(req, res, next)));

router.post('/bulk-update', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppAutomationController.bulkUpdateStatus(req, res, next)));

router.get('/stats', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppAutomationController.getStats(req, res, next)));

export default router;
