import { LeadData } from '../source-core/base-source';

export interface NormalizedLead {
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  source: string;
  sourceUrl?: string;
  leadScore: number;
  relevanceScore: number;
  validatedCategory: string;
  sources: string[];
  href?: string;
  placeId?: string;
  createdAt: string;
}

export class NormalizationService {
  normalizePhone(raw: string | undefined | null): string | undefined {
    if (!raw) return undefined;
    const digits = raw.replace(/[^\d+]/g, '');
    if (digits.length >= 10) {
      if (digits.startsWith('+91') && digits.length === 13) return digits;
      if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`;
      if (digits.length === 10) return `+91${digits}`;
      if (digits.length >= 10) return digits;
    }
    return undefined;
  }

  normalizeWebsite(raw: string | undefined | null): string | undefined {
    if (!raw) return undefined;
    let url = raw.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname.includes('google.com') ||
        parsed.hostname.includes('facebook.com') ||
        parsed.hostname.includes('instagram.com') ||
        parsed.hostname.includes('linkedin.com') ||
        parsed.hostname.includes('twitter.com') ||
        parsed.hostname.includes('youtube.com')
      ) {
        if (parsed.searchParams.get('q')) {
          const dest = parsed.searchParams.get('q');
          if (dest && !dest.includes('google.com')) {
            return dest;
          }
        }
        return undefined;
      }
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return undefined;
    }
  }

  normalizeEmail(raw: string | undefined | null): string | undefined {
    if (!raw) return undefined;
    const email = raw.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
    return undefined;
  }

  normalizeAddress(raw: string | undefined | null): string | undefined {
    if (!raw) return undefined;
    return raw.trim().replace(/\s+/g, ' ');
  }

  normalizeCategory(raw: string | undefined | null): string | undefined {
    if (!raw) return undefined;
    return raw.trim();
  }

  normalize(data: LeadData): Partial<NormalizedLead> {
    return {
      companyName: data.companyName?.trim() || '',
      website: this.normalizeWebsite(data.website),
      phone: this.normalizePhone(data.phone),
      email: this.normalizeEmail(data.email),
      address: this.normalizeAddress(data.address),
      category: this.normalizeCategory(data.category),
      rating: data.rating,
      reviewsCount: data.reviewsCount,
      source: data.source,
      sourceUrl: data.sourceUrl,
      leadScore: data.leadScore || 30,
      relevanceScore: 0,
      validatedCategory: '',
      sources: [data.source],
      href: data.href,
      placeId: data.placeId,
      createdAt: data.createdAt,
    };
  }
}

export const normalizationService = new NormalizationService();
