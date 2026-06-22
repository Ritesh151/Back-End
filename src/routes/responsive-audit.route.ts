import { Router } from 'express';
import { responsiveAuditController } from '../controllers/responsive-audit.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();

router.post('/audit/:leadId', authenticate, validateObjectId('leadId'), (req, res) => 
  responsiveAuditController.auditSingleLead(req, res)
);

router.post('/audit-bulk', authenticate, (req, res) => 
  responsiveAuditController.auditMultipleLeads(req, res)
);

router.post('/audit-pending', authenticate, (req, res) => 
  responsiveAuditController.auditLeadsWithoutAudit(req, res)
);

router.get('/stats', authenticate, (req, res) => 
  responsiveAuditController.getAuditStats(req, res)
);

router.post('/reaudit/:leadId', authenticate, validateObjectId('leadId'), (req, res) => 
  responsiveAuditController.reauditLead(req, res)
);

export default router;
