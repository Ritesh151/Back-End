import { Router, Request, Response, NextFunction } from 'express';
import { businessEmailDiscoveryService } from '../services/business-email-discovery.service';
import { Lead } from '../models/Lead';
import { asyncHandler } from '../utils/error-handler';
import { APIResponse } from '../utils/api-response';
import { z } from 'zod';
import { validate } from '../utils/validations';

const router = Router();

const discoverSchema = z.object({
  params: z.object({
    leadId: z.string().min(1, 'leadId is required'),
  }),
});

const backfillSchema = z.object({
  body: z.object({
    concurrency: z.number().min(1).max(20).optional().default(5),
  }),
});

router.post('/:leadId', validate(discoverSchema), asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { leadId } = req.params;

  const lead = await Lead.findById(leadId);
  if (!lead) {
    return APIResponse.error(res, 'Lead not found', null, 404);
  }

  const asyncMode = req.query.async === 'true';

  if (asyncMode) {
    await Lead.findByIdAndUpdate(leadId, {
      $set: { emailDiscoveryStatus: 'scanning' },
    });

    businessEmailDiscoveryService.discoverEmailsForLeadAsync(leadId);

    return APIResponse.success(res, {
      status: 'scanning',
      message: 'Email discovery started in background',
    }, 'Email discovery initiated');
  }

  const result = await businessEmailDiscoveryService.discoverEmailsForLead(leadId);

  if (result.success) {
    return APIResponse.success(res, result, 'Email discovery completed');
  }

  return APIResponse.error(res, result.error || 'Email discovery failed', null, 500);
}));

router.get('/:leadId/result', validate(discoverSchema), asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { leadId } = req.params;

  const lead = await Lead.findById(leadId).select(
    'discoveredEmails primaryEmail emailCount emailDiscoveryStatus emailDiscoveryError lastEmailScan'
  );

  if (!lead) {
    return APIResponse.error(res, 'Lead not found', null, 404);
  }

  return APIResponse.success(res, {
    discoveredEmails: lead.discoveredEmails || [],
    primaryEmail: lead.primaryEmail || '',
    emailCount: lead.emailCount || 0,
    status: lead.emailDiscoveryStatus || 'pending',
    error: lead.emailDiscoveryError || null,
    lastEmailScan: lead.lastEmailScan || null,
  }, 'Email discovery status');
}));

router.post('/backfill/start', validate(backfillSchema), asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const concurrency = req.body.concurrency || 5;

  setImmediate(async () => {
    try {
      await businessEmailDiscoveryService.backfillAllLeads(concurrency);
    } catch (_error: unknown) {
      // background task
    }
  });

  return APIResponse.success(res, { message: 'Backfill started in background' }, 'Backfill initiated');
}));

router.get('/backfill/status', asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const pending = await Lead.countDocuments({
    hasWebsite: true,
    website: { $exists: true, $nin: ['', null] },
    $or: [
      { emailDiscoveryStatus: { $in: ['pending', 'failed', null] } },
      { emailDiscoveryStatus: { $exists: false } },
    ],
  });

  const completed = await Lead.countDocuments({
    emailDiscoveryStatus: 'completed',
  });

  const failed = await Lead.countDocuments({
    emailDiscoveryStatus: 'failed',
  });

  const totalWithWebsite = await Lead.countDocuments({
    hasWebsite: true,
    website: { $exists: true, $nin: ['', null] },
  });

  return APIResponse.success(res, { pending, completed, failed, total: totalWithWebsite }, 'Backfill status');
}));

export default router;
