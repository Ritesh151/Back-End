import { Router, Request, Response } from 'express';
import { salesIntelligenceController } from '../controllers/sales-intelligence.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/analyze/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) =>
  salesIntelligenceController.analyzeSingleLead(req, res)
);

router.post('/analyze-bulk', authenticate, (req: Request, res: Response) =>
  salesIntelligenceController.analyzeMultipleLeads(req, res)
);

router.post('/analyze-pending', authenticate, (req: Request, res: Response) =>
  salesIntelligenceController.analyzeLeadsWithoutAnalysis(req, res)
);

router.get('/stats', authenticate, (req: Request, res: Response) =>
  salesIntelligenceController.getSalesStats(req, res)
);

export default router;
