import { Router } from 'express';
import { salesIntelligenceController } from '../controllers/sales-intelligence.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/analyze/:leadId', authenticate, validateObjectId('leadId'), (req, res) =>
  salesIntelligenceController.analyzeSingleLead(req, res)
);

router.post('/analyze-bulk', authenticate, (req, res) =>
  salesIntelligenceController.analyzeMultipleLeads(req, res)
);

router.post('/analyze-pending', authenticate, (req, res) =>
  salesIntelligenceController.analyzeLeadsWithoutAnalysis(req, res)
);

router.get('/stats', authenticate, (req, res) =>
  salesIntelligenceController.getSalesStats(req, res)
);

export default router;
