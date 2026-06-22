import { Lead } from '../models/Lead';
import { classifyWebsiteUrl } from '../modules/leads/services/urlClassifier.service';

export interface GeneratedMessage {
  leadId: string;
  companyName: string;
  phone: string;
  normalizedPhone: string;
  message: string;
  templateType: 'website' | 'no-website';
  hasWebsite: boolean;
  whatsappUrl: string;
  skipReason: string | null;
}

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

function isRealBusinessWebsite(url: string | null | undefined, _lead?: Record<string, unknown>): boolean {
  return classifyWebsiteUrl(url).hasRealWebsite;
}

function buildWebsiteMessage(_companyName: string): string {
  return `Hi,

I am Ritesh Gajjar from Opti Matrix Solutions.

We provide a wide range of digital services, including:

• Website Development
• Custom Web Application Development
• Mobile Application Development (Android & iOS)
• eCommerce Solutions & Online Stores
• Responsive Web Design & UI/UX Design
• CMS & Open-Source Development
• Search Engine Optimization (SEO)
• Digital Marketing & Social Media Marketing (SMM)
• Website Maintenance & Technical Support

We noticed that your website has opportunities for improvement in performance, user experience, and online visibility.

Could you please let us know a convenient time for a quick discussion?

Best Regards,
Ritesh Gajjar
Opti Matrix Solutions`;
}

function buildNoWebsiteMessage(_companyName: string): string {
  return `Hi,

I am Ritesh Gajjar from Opti Matrix Solutions.

We provide a wide range of digital services including:

• Website Development
• Mobile App Development
• eCommerce Solutions
• SEO & Digital Marketing
• UI/UX Design
• Website Maintenance

We noticed that your business currently does not have a professional website.

A dedicated website can help improve visibility, credibility, and customer reach.

Could you please let us know a convenient time for a quick discussion?

Best Regards,
Ritesh Gajjar
Opti Matrix Solutions`;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  const digits = phone.replace(/\D/g, '');
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encoded}`;
}

export class WhatsAppMessageService {
  async generateMessages(leadIds: string[]): Promise<{
    messages: GeneratedMessage[];
    skipped: Array<{ leadId: string; companyName: string; reason: string }>;
  }> {
    const leads = await Lead.find({ _id: { $in: leadIds } }).lean();

    const messages: GeneratedMessage[] = [];
    const skipped: Array<{ leadId: string; companyName: string; reason: string }> = [];

    for (const lead of leads) {
      const leadId = (lead._id as { toString(): string }).toString();
      const leadRecord = lead as Record<string, unknown>;
      const phone = normalizePhone(lead.phone as string | null | undefined);

      if (!phone) {
        skipped.push({
          leadId,
          companyName: lead.companyName || 'Unknown',
          reason: 'Invalid or missing phone number',
        });
        await Lead.findByIdAndUpdate(leadId, {
          $set: { 'whatsappOutreach.status': 'skipped', 'whatsappOutreach.lastError': 'Invalid or missing phone number' },
        }).catch(() => { });
        continue;
      }

      const hasWebsite = isRealBusinessWebsite(lead.website as string | null | undefined, leadRecord);
      const templateType: 'website' | 'no-website' = hasWebsite ? 'website' : 'no-website';
      const message = hasWebsite ? buildWebsiteMessage(lead.companyName || '') : buildNoWebsiteMessage(lead.companyName || '');
      const whatsappUrl = buildWhatsAppUrl(phone, message);

      messages.push({
        leadId,
        companyName: lead.companyName || 'Unknown',
        phone: lead.phone || '',
        normalizedPhone: phone,
        message,
        templateType,
        hasWebsite,
        whatsappUrl,
        skipReason: null,
      });

      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          'whatsappOutreach.status': 'prepared',
          'whatsappOutreach.templateType': templateType,
          'whatsappOutreach.lastOpenedAt': new Date().toISOString(),
          'whatsappOutreach.lastError': null,
        },
      }).catch(() => { });
    }

    return { messages, skipped };
  }
}

export const whatsAppMessageService = new WhatsAppMessageService();
