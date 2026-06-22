import { Router, Request, Response } from 'express';
import { outreachController } from '../controllers/outreach.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/generate/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) =>
  outreachController.generateForLead(req, res)
);

router.post('/generate-bulk', authenticate, (req: Request, res: Response) =>
  outreachController.generateForMultipleLeads(req, res)
);

router.post('/generate-pending', authenticate, (req: Request, res: Response) =>
  outreachController.generateForPendingLeads(req, res)
);

router.get('/lead/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) =>
  outreachController.getLeadOutreach(req, res)
);

router.put('/status/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) =>
  outreachController.updateStatus(req, res)
);

router.get('/stats', authenticate, (req: Request, res: Response) =>
  outreachController.getStats(req, res)
);

export default router;
