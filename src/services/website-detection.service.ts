import { classifyWebsiteUrl } from '../modules/leads/services/urlClassifier.service';

export type DetectedWebsiteType = 'STANDALONE' | 'PROFILE_ONLY' | 'UNKNOWN';
export type WebsitePresenceStatus = 'YES' | 'NO';

export interface WebsiteDetectionResult {
  hasWebsite: boolean;
  websiteStatus: WebsitePresenceStatus;
  websiteType: DetectedWebsiteType;
  hasRealWebsite: boolean;
}

export interface LeadWebsiteDetectionFields {
  hasWebsite: boolean;
  websiteStatus: WebsitePresenceStatus;
  detectedWebsiteType: DetectedWebsiteType;
  hasRealWebsite: boolean;
  websiteType: string;
  websiteClassification: string;
  websiteAuditAllowed: boolean;
}

function getDetectedType(wt: string): DetectedWebsiteType {
  if (wt === 'REAL_WEBSITE') return 'STANDALONE';
  if (wt === 'SOCIAL_PROFILE' || wt === 'GOOGLE_PROFILE' || wt === 'MARKETPLACE_PROFILE' || wt === 'DIRECTORY_PROFILE') return 'PROFILE_ONLY';
  return 'UNKNOWN';
}

export class WebsiteDetectionService {
  detect(url: string | null | undefined): WebsiteDetectionResult {
    if (!url || !url.trim()) {
      return { hasWebsite: false, websiteStatus: 'NO', websiteType: 'UNKNOWN', hasRealWebsite: false };
    }

    const classified = classifyWebsiteUrl(url);
    const hasWebsite = classified.hasRealWebsite;

    return {
      hasWebsite,
      websiteStatus: hasWebsite ? 'YES' : 'NO',
      websiteType: getDetectedType(classified.websiteType),
      hasRealWebsite: hasWebsite,
    };
  }

  getLeadFields(url: string | null | undefined): LeadWebsiteDetectionFields {
    const classified = classifyWebsiteUrl(url);
    const hasWebsite = classified.hasRealWebsite;

    return {
      hasWebsite,
      websiteStatus: hasWebsite ? 'YES' : 'NO',
      detectedWebsiteType: getDetectedType(classified.websiteType),
      hasRealWebsite: hasWebsite,
      websiteType: classified.websiteType,
      websiteClassification: classified.normalizedUrl ? (
        classified.websiteType === 'REAL_WEBSITE' ? 'business_website'
        : classified.websiteType === 'SOCIAL_PROFILE' ? 'social_profile'
        : classified.websiteType === 'GOOGLE_PROFILE' ? 'google_business_profile'
        : 'directory_listing'
      ) : 'no_website',
      websiteAuditAllowed: hasWebsite,
    };
  }

  resolveLeadHasWebsite(lead: {
    website?: string | null;
    hasWebsite?: boolean;
    hasRealWebsite?: boolean;
  }): boolean {
    if (typeof lead.hasWebsite === 'boolean') return lead.hasWebsite;
    if (typeof lead.hasRealWebsite === 'boolean') return lead.hasRealWebsite;
    return classifyWebsiteUrl(lead.website).hasRealWebsite;
  }
}

export const websiteDetectionService = new WebsiteDetectionService();
