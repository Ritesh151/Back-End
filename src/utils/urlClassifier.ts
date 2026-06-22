import { classifyWebsite, WebsiteClassification } from './websiteClassifier';

export interface ClassifiedPlatform {
  platform: string;
  url: string;
  classification: WebsiteClassification;
  displayName: string;
}

export interface UrlClassificationResult {
  hasRealWebsite: boolean;
  websiteClassification: WebsiteClassification;
  websiteAuditAllowed: boolean;
  socialPlatforms: string[];
  primaryPlatform: string | undefined;
  platforms: ClassifiedPlatform[];
}

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  'instagram': 'Instagram Profile',
  'facebook': 'Facebook Page',
  'whatsapp': 'WhatsApp Number',
  'linkedin': 'LinkedIn Profile',
  'youtube': 'YouTube Channel',
  'twitter': 'X (Twitter) Profile',
  'x': 'X (Twitter) Profile',
  'threads': 'Threads Profile',
  'snapchat': 'Snapchat Profile',
  'pinterest': 'Pinterest Profile',
  'telegram': 'Telegram Profile',
  'google-maps': 'Google Maps Listing',
  'google-business': 'Google Business Profile',
  'justdial': 'JustDial Listing',
  'indiamart': 'IndiaMart Listing',
  'sulekha': 'Sulekha Listing',
  'tradeindia': 'TradeIndia Listing',
  'yellowpages': 'YellowPages Listing',
  'tripadvisor': 'TripAdvisor Listing',
  'yelp': 'Yelp Listing',
};

const PLATFORM_ORDER: Record<string, number> = {
  'google-business': 0,
  'instagram': 1,
  'facebook': 2,
  'whatsapp': 3,
  'linkedin': 4,
  'youtube': 5,
  'twitter': 6,
  'x': 7,
  'justdial': 8,
  'indiamart': 9,
  'google-maps': 10,
};

const PRIMARY_PRIORITY: Record<string, number> = {
  'instagram': 1,
  'facebook': 2,
  'whatsapp': 3,
  'linkedin': 4,
  'google-business': 5,
};

function platformOrder(platform: string): number {
  return PLATFORM_ORDER[platform] ?? 99;
}

export function classifyLeadUrls(lead: {
  website?: string | null;
  sourceUrl?: string | null;
  socialLinks?: Record<string, string | string[] | undefined>;
  marketplaceLinks?: Record<string, string | string[] | undefined>;
  mapsLinks?: string[];
}): UrlClassificationResult {
  const allUrls: Array<{ url: string; context: string }> = [];

  if (lead.website) allUrls.push({ url: lead.website, context: 'website' });
  if (lead.sourceUrl) allUrls.push({ url: lead.sourceUrl, context: 'sourceUrl' });

  if (lead.socialLinks) {
    for (const [key, value] of Object.entries(lead.socialLinks)) {
      if (key === 'other' && Array.isArray(value)) {
        for (const v of value) { if (v) allUrls.push({ url: v, context: 'social' }); }
      } else if (typeof value === 'string' && value) {
        allUrls.push({ url: value, context: 'social' });
      }
    }
  }

  if (lead.marketplaceLinks) {
    for (const [key, value] of Object.entries(lead.marketplaceLinks)) {
      if (key === 'other' && Array.isArray(value)) {
        for (const v of value) { if (v) allUrls.push({ url: v, context: 'marketplace' }); }
      } else if (typeof value === 'string' && value) {
        allUrls.push({ url: value, context: 'marketplace' });
      }
    }
  }

  if (lead.mapsLinks) {
    for (const url of lead.mapsLinks) {
      if (url) allUrls.push({ url, context: 'maps' });
    }
  }

  const seen = new Set<string>();
  const platforms: ClassifiedPlatform[] = [];

  for (const { url } of allUrls) {
    const normalized = url.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const result = classifyWebsite(url);
    const platform = result.socialPlatform || result.websiteType || 'unknown';
    platforms.push({
      platform,
      url,
      classification: result.websiteClassification,
      displayName: PLATFORM_DISPLAY_NAMES[platform] || 'Website',
    });
  }

  platforms.sort((a, b) => platformOrder(a.platform) - platformOrder(b.platform));

  const socialPlatforms = [...new Set(platforms
    .filter(p => p.classification !== 'business_website')
    .map(p => p.platform))];

  let primaryPlatform: string | undefined;
  let bestPriority = Infinity;
  for (const p of platforms) {
    const pri = PRIMARY_PRIORITY[p.platform] ?? 99;
    if (pri < bestPriority) {
      bestPriority = pri;
      primaryPlatform = p.platform;
    }
  }

  const hasRealWebsite = platforms.some(p => p.classification === 'business_website');
  const websiteAuditAllowed = hasRealWebsite;
  const websiteClassification: WebsiteClassification = hasRealWebsite
    ? 'business_website'
    : socialPlatforms.length > 0
      ? (socialPlatforms.some(p => p === 'google-business' || p === 'google-maps')
        ? 'google_business_profile'
        : 'social_profile')
      : 'no_website';

  return {
    hasRealWebsite,
    websiteClassification,
    websiteAuditAllowed,
    socialPlatforms,
    primaryPlatform,
    platforms,
  };
}
