import { Router } from 'express';
import { businessIntelligenceController } from '../controllers/business-intelligence.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/analyze/:leadId', authenticate, validateObjectId('leadId'), (req, res) =>
  businessIntelligenceController.analyzeSingleLead(req, res)
);

router.post('/analyze-bulk', authenticate, (req, res) =>
  businessIntelligenceController.analyzeMultipleLeads(req, res)
);

router.post('/analyze-pending', authenticate, (req, res) =>
  businessIntelligenceController.analyzeLeadsWithoutIntelligence(req, res)
);

router.get('/stats', authenticate, (req, res) =>
  businessIntelligenceController.getIntelligenceStats(req, res)
);

router.post('/reanalyze/:leadId', authenticate, validateObjectId('leadId'), (req, res) =>
  businessIntelligenceController.reanalyzeLead(req, res)
);

export default router;
