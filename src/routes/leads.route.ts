import { Router, Request, Response, NextFunction } from 'express';
import { leadController } from '../controllers/lead.controller';
import { LeadQualificationService } from '../services/lead-qualification.service';
import { asyncHandler } from '../utils/error-handler';
import { APIResponse } from '../utils/api-response';
import { authenticate } from '../middlewares/auth.middleware';
import { validateObjectId } from '../middlewares/validate-objectid.middleware';

const router = Router();
const leadQualificationService = new LeadQualificationService();

router.get('/', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getLeads(req, res, next)));

router.get('/statistics', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getLeadStatistics(req, res, next)));

router.get('/filter-options', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getFilterOptions(req, res, next)));

router.get('/filter-counts', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getFilterCounts(req, res, next)));

router.get('/categories', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getCategories(req, res, next)));

router.get('/keyword-stats', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getKeywordStats(req, res, next)));

router.delete('/delete-all', authenticate, asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.deleteAllLeads(req, res, next)));

router.get('/stats', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getQualificationStats(req, res, next)));

router.get('/qualified', asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const page = parseInt(req.query.page?.toString() || '1', 10);
  const limit = parseInt(req.query.limit?.toString() || '10', 10);
  const qualificationLevel = req.query.qualificationLevel?.toString() as any;
  const websiteStatus = req.query.websiteStatus?.toString() as any;
  const minLeadScore = req.query.minLeadScore ? parseFloat(req.query.minLeadScore.toString()) : undefined;
  const maxLeadScore = req.query.maxLeadScore ? parseFloat(req.query.maxLeadScore.toString()) : undefined;

  const result = await leadQualificationService.getQualifiedLeads({
    page, limit, qualificationLevel, websiteStatus, minLeadScore, maxLeadScore,
  });

  APIResponse.success(res, result, 'Qualified leads fetched successfully');
}));

router.get('/:id', validateObjectId('id'), asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getLead(req, res, next)));

router.post('/', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.createLead(req, res, next)));

router.post('/bulk-analyze', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.bulkAnalyzeLeads(req, res, next)));

router.post('/requalify', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.requalifyUnanalyzedLeads(req, res, next)));

router.post('/audit/trigger', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.triggerLeadAudits(req, res, next)));

router.post('/audit/trigger-bulk', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.triggerBulkAudits(req, res, next)));

router.post('/audit/trigger-all', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.triggerAllMissingAudits(req, res, next)));

router.post('/audit/reprocess-all', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.reprocessAllLeads(req, res, next)));

router.post('/reclassify', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.reclassifyLeads(req, res, next)));

router.get('/classification-stats', asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.getClassificationStats(req, res, next)));

router.post('/:id/analyze', validateObjectId('id'), asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.analyzeLead(req, res, next)));

router.put('/:id', validateObjectId('id'), asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.updateLead(req, res, next)));

router.delete('/:id', validateObjectId('id'), asyncHandler((req: Request, res: Response, next: NextFunction) => leadController.deleteLead(req, res, next)));

export default router;
