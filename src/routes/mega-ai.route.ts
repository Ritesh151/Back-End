import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { megaAIController } from '../controllers/mega-ai.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

router.post('/analyze/:leadId', authenticate, validateObjectId('leadId'), (req, res) => {
  megaAIController.analyzeLead(req, res);
});

router.post('/analyze-bulk', authenticate, (req, res) => {
  megaAIController.analyzeMultipleLeads(req, res);
});

router.post('/analyze-pending', authenticate, asyncHandler(async (req, res) => {
  await megaAIController.analyzePendingLeads(req, res);
}));

router.get('/pipeline-stats', authenticate, asyncHandler(async (req, res) => {
  await megaAIController.getPipelineStats(req, res);
}));

router.get('/status/:leadId', authenticate, validateObjectId('leadId'), asyncHandler(async (req, res) => {
  await megaAIController.getLeadAIStatus(req, res);
}));

router.post('/refresh/:leadId', authenticate, validateObjectId('leadId'), asyncHandler(async (req, res) => {
  await megaAIController.refreshAnalysis(req, res);
}));

export default router;
