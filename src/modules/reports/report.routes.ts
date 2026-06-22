import { Router } from 'express';
import { reportController } from './report.controller';

const router = Router();

router.post('/generate/:leadId', (req, res, next) => reportController.generateReport(req, res, next));
router.get('/status/:leadId', (req, res, next) => reportController.getReportStatus(req, res, next));
router.get('/progress/:leadId', (req, res, next) => reportController.getReportProgress(req, res, next));
router.get('/view/:leadId', (req, res, next) => reportController.viewReport(req, res, next));
router.get('/download/:leadId', (req, res, next) => reportController.downloadReport(req, res, next));
router.delete('/:leadId', (req, res, next) => reportController.deleteReport(req, res, next));

export default router;
