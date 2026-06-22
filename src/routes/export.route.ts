import { Router, Request, Response, NextFunction } from 'express';
import { exporterController } from '../controllers/exporter.controller';
import { validate } from '../utils/validations';
import { z } from 'zod';

const router = Router();

// CSV Export Schema
const csvExportSchema = z.object({
  query: z.object({
    qualificationLevel: z.enum(['high-potential', 'medium-potential', 'low-potential']).optional(),
    websiteStatus: z.enum(['no-website', 'broken-website', 'outdated-website', 'average-website', 'modern-website']).optional(),
    category: z.string().optional(),
    minLeadScore: z.coerce.number().optional(),
    maxLeadScore: z.coerce.number().optional(),
    search: z.string().optional(),
  }).optional(),
});

// Excel Export Schema
const excelExportSchema = z.object({
  query: z.object({
    qualificationLevel: z.enum(['high-potential', 'medium-potential', 'low-potential']).optional(),
    websiteStatus: z.enum(['no-website', 'broken-website', 'outdated-website', 'average-website', 'modern-website']).optional(),
    category: z.string().optional(),
    minLeadScore: z.coerce.number().optional(),
    maxLeadScore: z.coerce.number().optional(),
    search: z.string().optional(),
  }).optional(),
});

// Export Schema for search results
const exportSearchSchema = z.object({
  body: z.object({
    keyword: z.string().min(1, 'Keyword is required'),
    location: z.string().min(1, 'Location is required'),
  }),
  query: z.object({
    qualificationLevel: z.enum(['high-potential', 'medium-potential', 'low-potential']).optional(),
    websiteStatus: z.enum(['no-website', 'broken-website', 'outdated-website', 'average-website', 'modern-website']).optional(),
    category: z.string().optional(),
    format: z.enum(['csv', 'excel']).optional().default('excel'),
    minLeadScore: z.coerce.number().optional(),
    maxLeadScore: z.coerce.number().optional(),
  }).optional(),
});

// GET /api/v1/export/csv - Export leads to CSV
router.get('/csv', validate(csvExportSchema), (req: Request, res: Response, next: NextFunction) => {
  exporterController.exportToCSV(req, res, next);
});

router.get('/excel', validate(excelExportSchema), (req: Request, res: Response, next: NextFunction) => {
  exporterController.exportToExcel(req, res, next);
});

router.post('/search', validate(exportSearchSchema), (req: Request, res: Response, next: NextFunction) => {
  exporterController.exportSearchResults(req, res, next);
});

router.get('/detailed', (req: Request, res: Response, next: NextFunction) => {
  exporterController.exportWithFormatting(req, res, next);
});

export default router;
