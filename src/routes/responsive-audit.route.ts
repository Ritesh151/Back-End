import { Router, Request, Response } from 'express';
import { responsiveAuditController } from '../controllers/responsive-audit.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/audit/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) => 
  responsiveAuditController.auditSingleLead(req, res)
);

router.post('/audit-bulk', authenticate, (req: Request, res: Response) => 
  responsiveAuditController.auditMultipleLeads(req, res)
);

router.post('/audit-pending', authenticate, (req: Request, res: Response) => 
  responsiveAuditController.auditLeadsWithoutAudit(req, res)
);

router.get('/stats', authenticate, (req: Request, res: Response) => 
  responsiveAuditController.getAuditStats(req, res)
);

router.post('/reaudit/:leadId', authenticate, validateObjectId('leadId'), (req: Request, res: Response) => 
  responsiveAuditController.reauditLead(req, res)
);

export default router;
