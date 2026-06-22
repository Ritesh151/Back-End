import { Router, Request, Response } from 'express';
import { Lead } from '../models/Lead';
import { whatsAppTemplatesService } from '../services/whatsapp-templates.service';
import { asyncHandler } from '../utils/error-handler';
import { logger } from '../utils/logger';

const router = Router();

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('911')) return `+${digits.slice(1)}`;
  if (digits.length >= 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.startsWith('1')) return null;
  return `+${digits}`;
}

router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { leadIds, campaignId } = req.body as { leadIds?: string[]; campaignId?: string };

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json({ success: false, message: 'leadIds must be a non-empty array' });
    return;
  }

  if (!campaignId) {
    res.status(400).json({ success: false, message: 'campaignId is required' });
    return;
  }

  const leads = await Lead.find({
    _id: { $in: leadIds },
  }).select('companyName phone website category searchedCity searchedArea searchedState hasWebsite leadScore rating ownerNames').lean();

  if (leads.length === 0) {
    res.status(400).json({ success: false, message: 'No valid leads found' });
    return;
  }

  const templates = await whatsAppTemplatesService.getTemplatesForCampaign(campaignId);

  const generatedMessages = [];
  const skipped = [];

  for (const lead of leads) {
    const normalizedPhone = normalizePhone(lead.phone as string | null | undefined);
    if (!normalizedPhone) {
      skipped.push({
        leadId: String(lead._id),
        companyName: lead.companyName || 'Unknown',
        reason: 'Invalid or missing phone number',
      });
      continue;
    }

    const hasWebsite = !!(lead.hasWebsite || lead.website);
    const templateType = hasWebsite ? 'website' : 'no_website';
    const templateMessage = hasWebsite ? templates.website : templates.no_website;

    const ownerName = Array.isArray(lead.ownerNames) && lead.ownerNames.length > 0 ? lead.ownerNames[0] : undefined;

    const message = whatsAppTemplatesService.replacePlaceholders(templateMessage, {
      businessName: lead.companyName || undefined,
      ownerName,
      city: lead.searchedCity || undefined,
      area: lead.searchedArea || undefined,
      state: lead.searchedState || undefined,
      website: lead.website || undefined,
      phone: lead.phone || undefined,
      category: lead.category || undefined,
      rating: lead.rating,
      leadScore: lead.leadScore,
      companyName: lead.companyName || undefined,
    });

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;

    generatedMessages.push({
      leadId: String(lead._id),
      companyName: lead.companyName || 'Unknown',
      phone: lead.phone || '',
      normalizedPhone,
      message,
      templateType,
      hasWebsite,
      whatsappUrl,
      skipReason: null,
    });
  }

  logger.info(
    { total: leads.length, prepared: generatedMessages.length, skippedCount: skipped.length, campaignId },
    '[WhatsAppTemplates] Messages generated using templates'
  );

  res.status(200).json({
    success: true,
    data: generatedMessages,
    skipped,
    total: generatedMessages.length + skipped.length,
    skippedCount: skipped.length,
    prepared: generatedMessages.length,
    failed: 0,
    campaignId,
  });
}));

export default router;
