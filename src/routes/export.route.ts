import { Router } from 'express';
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
router.get('/csv', validate(csvExportSchema), (req, res, next) => {
  exporterController.exportToCSV(req, res, next);
});

// GET /api/v1/export/excel - Export leads to Excel
router.get('/excel', validate(excelExportSchema), (req, res, next) => {
  exporterController.exportToExcel(req, res, next);
});

// POST /api/v1/export/search - Export search results
router.post('/search', validate(exportSearchSchema), (req, res, next) => {
  exporterController.exportSearchResults(req, res, next);
});

// GET /api/v1/export/detailed - Export with detailed formatting
router.get('/detailed', (req, res, next) => {
  exporterController.exportWithFormatting(req, res, next);
});

export default router;
