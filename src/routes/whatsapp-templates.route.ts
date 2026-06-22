import { Router, Request, Response, NextFunction } from 'express';
import { whatsAppTemplateController } from '../controllers/whatsapp-template.controller';
import { asyncHandler } from '../utils/error-handler';

const router = Router();

router.get('/', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppTemplateController.getTemplates(req, res, next)));

router.put('/website', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppTemplateController.updateWebsiteTemplate(req, res, next)));

router.put('/no-website', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppTemplateController.updateNoWebsiteTemplate(req, res, next)));

router.post('/preview', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppTemplateController.previewTemplate(req, res, next)));

router.post('/reset', asyncHandler((req: Request, res: Response, next: NextFunction) => whatsAppTemplateController.resetTemplates(req, res, next)));

export default router;
