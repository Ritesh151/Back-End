import { WhatsAppTemplate } from '../models/WhatsAppTemplate';
import { logger } from '../utils/logger';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function invalidateAiTemplateCache(): Promise<void> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/whatsapp/templates/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      logger.info('[WhatsAppTemplates] AI service template cache invalidated');
    } else {
      logger.warn({ status: response.status }, '[WhatsAppTemplates] AI service cache invalidation failed');
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn({ err: errMsg }, '[WhatsAppTemplates] AI service cache invalidation error (non-blocking)');
  }
}

interface TemplateCacheEntry {
  website: string;
  no_website: string;
}

interface SenderInfo {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface LeadPlaceholderData {
  businessName?: string;
  ownerName?: string;
  city?: string;
  area?: string;
  state?: string;
  website?: string;
  phone?: string;
  category?: string;
  rating?: number | string;
  leadScore?: number | string;
  companyName?: string;
}

const DEFAULT_WEBSITE_TEMPLATE = `Hi {{businessName}},

I came across your website {{website}} and was impressed by your online presence. I specialize in helping businesses like yours grow with modern web solutions and digital marketing strategies.

Would you be open to a quick chat about how we can take your online presence to the next level?

Looking forward to hearing from you!

Best regards,
{{senderName}}
{{senderPhone}}`;

const DEFAULT_NO_WEBSITE_TEMPLATE = `Hi {{businessName}},

I noticed your business on {{category}} and wanted to reach out. I specialize in website development and digital marketing, helping businesses like yours establish a strong online presence.

A professional website can help you attract more customers and grow your business. Would you be interested in discussing how we can create a website for your business?

Looking forward to hearing from you!

Best regards,
{{senderName}}
{{senderPhone}}`;

export class WhatsAppTemplatesService {
  private templateCache: Map<string, TemplateCacheEntry> = new Map();

  private getDefaultWebsiteMessage(): string {
    return DEFAULT_WEBSITE_TEMPLATE;
  }

  private getDefaultNoWebsiteMessage(): string {
    return DEFAULT_NO_WEBSITE_TEMPLATE;
  }

  async getTemplates(): Promise<{ website: { name: string; message: string }; no_website: { name: string; message: string } }> {
    let websiteTemplate = await WhatsAppTemplate.findOne({ type: 'website' }).lean();
    let noWebsiteTemplate = await WhatsAppTemplate.findOne({ type: 'no_website' }).lean();

    if (!websiteTemplate) {
      await WhatsAppTemplate.findOneAndUpdate(
        { type: 'website' },
        { message: this.getDefaultWebsiteMessage(), name: 'Website Template' },
        { upsert: true }
      );
      websiteTemplate = await WhatsAppTemplate.findOne({ type: 'website' }).lean();
    }

    if (!noWebsiteTemplate) {
      await WhatsAppTemplate.findOneAndUpdate(
        { type: 'no_website' },
        { message: this.getDefaultNoWebsiteMessage(), name: 'No Website Template' },
        { upsert: true }
      );
      noWebsiteTemplate = await WhatsAppTemplate.findOne({ type: 'no_website' }).lean();
    }

    return {
      website: { name: websiteTemplate?.name ?? 'Website Template', message: websiteTemplate?.message ?? this.getDefaultWebsiteMessage() },
      no_website: { name: noWebsiteTemplate?.name ?? 'No Website Template', message: noWebsiteTemplate?.message ?? this.getDefaultNoWebsiteMessage() },
    };
  }

  async getTemplatesForCampaign(campaignId: string): Promise<TemplateCacheEntry> {
    const cached = this.templateCache.get(campaignId);
    if (cached) {
      return cached;
    }

    const templates = await this.getTemplates();
    const entry: TemplateCacheEntry = {
      website: templates.website.message,
      no_website: templates.no_website.message,
    };

    this.templateCache.set(campaignId, entry);
    return entry;
  }

  refreshCache(campaignId?: string): void {
    if (campaignId) {
      this.templateCache.delete(campaignId);
    } else {
      this.templateCache.clear();
    }
  }

  async updateTemplate(type: 'website' | 'no_website', message: string, name?: string): Promise<void> {
    const templateName = name || (type === 'website' ? 'Website Template' : 'No Website Template');

    await WhatsAppTemplate.findOneAndUpdate(
      { type },
      { message, name: templateName },
      { upsert: true }
    );

    this.refreshCache();
    await invalidateAiTemplateCache();
  }

  async resetToDefaults(): Promise<void> {
    await WhatsAppTemplate.findOneAndUpdate(
      { type: 'website' },
      { message: this.getDefaultWebsiteMessage(), name: 'Website Template' },
      { upsert: true }
    );

    await WhatsAppTemplate.findOneAndUpdate(
      { type: 'no_website' },
      { message: this.getDefaultNoWebsiteMessage(), name: 'No Website Template' },
      { upsert: true }
    );

    this.refreshCache();
    await invalidateAiTemplateCache();
  }

  sanitizeMessage(message: string): string {
    return message.trim();
  }

  getCharCount(message: string): number {
    return message.length;
  }

  isOverLimit(message: string, limit = 4000): boolean {
    return message.length > limit;
  }

  replacePlaceholders(message: string, lead: LeadPlaceholderData, senderInfo?: SenderInfo): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const replacements: Record<string, string> = {
      '{{businessName}}': lead.businessName || lead.companyName || '',
      '{{ownerName}}': lead.ownerName || '',
      '{{city}}': lead.city || '',
      '{{area}}': lead.area || '',
      '{{state}}': lead.state || '',
      '{{website}}': lead.website || '',
      '{{phone}}': lead.phone || '',
      '{{category}}': lead.category || '',
      '{{rating}}': lead.rating !== undefined && lead.rating !== null ? String(lead.rating) : '',
      '{{leadScore}}': lead.leadScore !== undefined && lead.leadScore !== null ? String(lead.leadScore) : '',
      '{{companyName}}': lead.companyName || lead.businessName || '',
      '{{senderName}}': senderInfo?.name || '',
      '{{senderPhone}}': senderInfo?.phone || '',
      '{{senderEmail}}': senderInfo?.email || '',
      '{{senderWebsite}}': senderInfo?.website || '',
      '{{currentDate}}': dateStr,
      '{{currentTime}}': timeStr,
    };

    let result = message;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.split(placeholder).join(value);
    }

    return result;
  }

  getSampleLeadData(): LeadPlaceholderData {
    return {
      businessName: 'ABC Gym',
      ownerName: 'Rahul Sharma',
      city: 'Ahmedabad',
      area: 'SG Highway',
      state: 'Gujarat',
      website: 'https://abcgym.com',
      phone: '+91 98765 43210',
      category: 'Fitness Center',
      rating: 4.5,
      leadScore: 92,
      companyName: 'ABC Gym',
    };
  }
}

export const whatsAppTemplatesService = new WhatsAppTemplatesService();
