import { Router, Request, Response, NextFunction } from 'express';
import { automationController } from '../controllers/automation.controller';
import { validate } from '../utils/validations';
import { z } from 'zod';

const router = Router();

// Schema for automation creation
const createAutomationSchema = z.object({
  body: z.object({
    keyword: z.string().min(2, 'Keyword must be at least 2 characters'),
    location: z.string().min(2, 'Location must be at least 2 characters'),
    frequency: z.enum(['hourly', 'daily', 'weekly']),
    limit: z.number().min(1).max(100).optional().default(50),
    category: z.string().optional(),
  }),
});

// Schema for automation update
const updateAutomationSchema = z.object({
  body: z.object({
    keyword: z.string().min(2).optional(),
    location: z.string().min(2).optional(),
    frequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
    limit: z.number().min(1).max(100).optional(),
    category: z.string().optional(),
    status: z.enum(['active', 'paused', 'failed']).optional(),
  }),
});

// GET /api/v1/automation - Get all automations
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  automationController.getAllAutomations(req, res, next);
});

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  automationController.getAutomation(req, res, next);
});

router.post('/', validate(createAutomationSchema), (req: Request, res: Response, next: NextFunction) => {
  automationController.createAutomation(req, res, next);
});

router.patch('/:id', validate(updateAutomationSchema), (req: Request, res: Response, next: NextFunction) => {
  automationController.updateAutomation(req, res, next);
});

router.patch('/:id/toggle', (req: Request, res: Response, next: NextFunction) => {
  automationController.toggleAutomation(req, res, next);
});

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  automationController.deleteAutomation(req, res, next);
});

router.post('/:id/run', (req: Request, res: Response, next: NextFunction) => {
  automationController.runAutomation(req, res, next);
});

router.get('/:id/logs', (req: Request, res: Response, next: NextFunction) => {
  automationController.getAutomationLogs(req, res, next);
});

router.get('/:id/statistics', (req: Request, res: Response, next: NextFunction) => {
  automationController.getAutomationStatistics(req, res, next);
});

router.get('/:id/exports', (req: Request, res: Response, next: NextFunction) => {
  automationController.getExportHistory(req, res, next);
});

export default router;
