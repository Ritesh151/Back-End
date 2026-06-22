import { Router } from 'express';
import { outreachController } from '../controllers/outreach.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/generate/:leadId', authenticate, validateObjectId('leadId'), (req, res) =>
  outreachController.generateForLead(req, res)
);

router.post('/generate-bulk', authenticate, (req, res) =>
  outreachController.generateForMultipleLeads(req, res)
);

router.post('/generate-pending', authenticate, (req, res) =>
  outreachController.generateForPendingLeads(req, res)
);

router.get('/lead/:leadId', authenticate, validateObjectId('leadId'), (req, res) =>
  outreachController.getLeadOutreach(req, res)
);

router.put('/status/:leadId', authenticate, validateObjectId('leadId'), (req, res) =>
  outreachController.updateStatus(req, res)
);

router.get('/stats', authenticate, (req, res) =>
  outreachController.getStats(req, res)
);

export default router;
