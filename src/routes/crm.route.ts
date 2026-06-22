import { Router } from 'express';
import { crmController } from '../controllers/crm.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/leads', authenticate, crmController.getLeads);
router.get('/pipeline', authenticate, crmController.getPipeline);
router.get('/stats', authenticate, crmController.getStats);
router.get('/analytics', authenticate, crmController.getAnalytics);
router.get('/lead/:leadId', authenticate, crmController.getLeadDetails);
router.patch('/stage/:leadId', authenticate, crmController.updateStage);
router.patch('/update-lead/:leadId', authenticate, crmController.updateLead);
router.patch('/assign/:leadId', authenticate, crmController.assignLead);
router.patch('/move/:leadId', authenticate, crmController.moveLead);

router.post('/note/:leadId', authenticate, crmController.addNote);
router.patch('/note/:noteId', authenticate, crmController.updateNote);
router.delete('/note/:noteId', authenticate, crmController.deleteNote);
router.get('/notes/:leadId', authenticate, crmController.getNotes);

router.post('/followup/:leadId', authenticate, crmController.createFollowUp);
router.patch('/followup/:followUpId', authenticate, crmController.updateFollowUp);
router.delete('/followup/:followUpId', authenticate, crmController.deleteFollowUp);
router.get('/followups/:leadId', authenticate, crmController.getFollowUps);

router.get('/activity/:leadId', authenticate, crmController.getActivities);

export default router;
