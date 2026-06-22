import { Router } from 'express';
import { automationController } from '../controllers/automation.controller';
import { validate } from '../utils/validations';
import { z } from 'zod';

const router = Router();

// Schema for automation creation
const createAutomationSchema = z.object({
  body: z.object({
    keyword: z.string().min(2, 'Keyword must be at least 2 characters'),
    location: z.string().min(2, 'Location must be at least 2 characters'),
    frequency: z.enum(['hourly', 'daily', 'weekly']),
    limit: z.number().min(1).max(100).optional().default(50),
    category: z.string().optional(),
  }),
});

// Schema for automation update
const updateAutomationSchema = z.object({
  body: z.object({
    keyword: z.string().min(2).optional(),
    location: z.string().min(2).optional(),
    frequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
    limit: z.number().min(1).max(100).optional(),
    category: z.string().optional(),
    status: z.enum(['active', 'paused', 'failed']).optional(),
  }),
});

// GET /api/v1/automation - Get all automations
router.get('/', (req, res, next) => {
  automationController.getAllAutomations(req, res, next);
});

// GET /api/v1/automation/:id - Get automation by ID
router.get('/:id', (req, res, next) => {
  automationController.getAutomation(req, res, next);
});

// POST /api/v1/automation - Create new automation
router.post('/', validate(createAutomationSchema), (req, res, next) => {
  automationController.createAutomation(req, res, next);
});

// PATCH /api/v1/automation/:id - Update automation
router.patch('/:id', validate(updateAutomationSchema), (req, res, next) => {
  automationController.updateAutomation(req, res, next);
});

// PATCH /api/v1/automation/:id/toggle - Toggle automation status
router.patch('/:id/toggle', (req, res, next) => {
  automationController.toggleAutomation(req, res, next);
});

// DELETE /api/v1/automation/:id - Delete automation
router.delete('/:id', (req, res, next) => {
  automationController.deleteAutomation(req, res, next);
});

// POST /api/v1/automation/:id/run - Run automation manually
router.post('/:id/run', (req, res, next) => {
  automationController.runAutomation(req, res, next);
});

// GET /api/v1/automation/:id/logs - Get automation logs
router.get('/:id/logs', (req, res, next) => {
  automationController.getAutomationLogs(req, res, next);
});

// GET /api/v1/automation/:id/statistics - Get automation statistics
router.get('/:id/statistics', (req, res, next) => {
  automationController.getAutomationStatistics(req, res, next);
});

// GET /api/v1/automation/:id/exports - Get export history
router.get('/:id/exports', (req, res, next) => {
  automationController.getExportHistory(req, res, next);
});

export default router;
