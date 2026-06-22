import { Router, Request, Response } from 'express';
import { businessIntelligenceController } from '../controllers/business-intelligence.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/analyze/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) =>
  businessIntelligenceController.analyzeSingleLead(req, res)
);

router.post('/analyze-bulk', authenticate, (req: Request, res: Response) =>
  businessIntelligenceController.analyzeMultipleLeads(req, res)
);

router.post('/analyze-pending', authenticate, (req: Request, res: Response) =>
  businessIntelligenceController.analyzeLeadsWithoutIntelligence(req, res)
);

router.get('/stats', authenticate, (req: Request, res: Response) =>
  businessIntelligenceController.getIntelligenceStats(req, res)
);

router.post('/reanalyze/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) =>
  businessIntelligenceController.reanalyzeLead(req, res)
);

export default router;
