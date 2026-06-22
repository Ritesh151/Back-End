import { ScraperLead } from './types';

export class LeadNormalizer {
  normalize(lead: ScraperLead, context: {
    keyword: string;
    location: string;
    state?: string;
    city?: string;
    area?: string;
    businessType: string;
    source: string;
  }): ScraperLead {
    return {
      ...lead,
      companyName: this.normalizeName(lead.companyName),
      phone: this.normalizePhone(lead.phone),
      website: this.normalizeWebsite(lead.website),
      address: this.normalizeAddress(lead.address),
      source: context.source,
      state: context.state || lead.state,
      city: context.city || lead.city,
      area: context.area || lead.area,
      businessType: context.businessType || lead.businessType,
    };
  }

  normalizeName(name: string): string {
    if (!name) return '';
    let normalized = name.trim();
    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.replace(/[^\w\s&.,'-]/g, '');
    const words = ['the', 'a', 'an', 'pvt', 'ltd', 'limited', 'private', 'llp', 'inc'];
    const wordRegex = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
    normalized = normalized.replace(wordRegex, (match) => match.toLowerCase());
    return normalized;
  }

  normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    let cleaned = phone.replace(/[\s\-().]/g, '');
    cleaned = cleaned.replace(/^(?:\+?91)?(\d{10})$/, (_, d) => d);
    const digits = cleaned.replace(/[^\d]/g, '');
    if (digits.length === 10 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 13 && digits.startsWith('+91')) return digits.slice(3);
    if (digits.length >= 10) return digits;
    return undefined;
  }

  normalizeWebsite(website?: string): string | undefined {
    if (!website) return undefined;
    let normalized = website.trim();
    try {
      const parsed = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return undefined;
    }
  }

  normalizeAddress(address?: string): string | undefined {
    if (!address) return undefined;
    let normalized = address.trim();
    normalized = normalized.replace(/\s+/g, ' ');
    return normalized;
  }

  getDedupKey(lead: ScraperLead): string[] {
    const keys: string[] = [];
    if (lead.phone && lead.phone.length >= 10) {
      keys.push(`phone:${lead.phone}`);
    }
    if (lead.website) {
      keys.push(`website:${lead.website}`);
    }
    if (lead.placeId) {
      keys.push(`placeId:${lead.placeId}`);
    }
    if (lead.companyName) {
      const name = lead.companyName.toLowerCase().replace(/\s+/g, '');
      const city = (lead.city || '').toLowerCase().replace(/\s+/g, '');
      keys.push(`name:${name}|${city}`);
    }
    return keys;
  }
}

export const leadNormalizer = new LeadNormalizer();
