import { websiteClassificationService as classifier, classifyWebsiteUrl, isRealWebsite, isOnlineProfile, getWebsiteClassification, setLeadClassificationFields } from '../modules/leads/services/urlClassifier.service';
import type { WebsiteClassificationType, ClassifiedWebsite, SocialProfiles, WebsiteClassificationType as WCT } from '../modules/leads/services/urlClassifier.service';

export type WebsiteClassificationResult =
  | 'STANDALONE_WEBSITE'
  | 'SOCIAL_PROFILE'
  | 'DIRECTORY_PROFILE'
  | 'NO_WEBSITE';

export interface WebsiteClassificationOutput {
  classification: WebsiteClassificationResult;
  hasRealWebsite: boolean;
  displayLabel: string;
  domain: string | null;
  originalUrl: string | null;
  normalizedUrl: string | null;
}

export interface LeadWebsiteFields {
  website: string | null;
  websiteType: WebsiteClassificationType;
  websiteClassification: 'business_website' | 'social_profile' | 'google_business_profile' | 'directory_listing' | 'no_website';
  websiteStatus: string;
  hasRealWebsite: boolean;
  websiteAuditAllowed: boolean;
  socialProfiles: Record<string, unknown>;
  socialPlatforms: string[];
  primaryPlatform?: string;
}

export class WebsiteClassificationService {
  classify(url: string | null | undefined): WebsiteClassificationOutput {
    const classified = classifier.classifyWebsiteUrl(url);

    let classification: WebsiteClassificationResult;
    let displayLabel: string;

    switch (classified.websiteType) {
      case 'REAL_WEBSITE':
        classification = 'STANDALONE_WEBSITE';
        displayLabel = 'Standalone Website';
        break;
      case 'SOCIAL_PROFILE':
        classification = 'SOCIAL_PROFILE';
        displayLabel = 'Social Profile';
        break;
      case 'GOOGLE_PROFILE':
      case 'MARKETPLACE_PROFILE':
      case 'DIRECTORY_PROFILE':
        classification = 'DIRECTORY_PROFILE';
        displayLabel = classified.displayLabel;
        break;
      default:
        classification = 'NO_WEBSITE';
        displayLabel = 'No Website';
    }

    let domain: string | null = null;
    if (classified.normalizedUrl) {
      try {
        domain = new URL(classified.normalizedUrl).hostname.replace(/^www\./, '');
      } catch {
        domain = classified.normalizedUrl;
      }
    }

    return {
      classification,
      hasRealWebsite: classified.hasRealWebsite,
      displayLabel,
      domain,
      originalUrl: classified.originalUrl,
      normalizedUrl: classified.normalizedUrl,
    };
  }

  isStandaloneWebsite(url: string | null | undefined): boolean {
    return this.classify(url).classification === 'STANDALONE_WEBSITE';
  }

  getDomain(url: string | null | undefined): string | null {
    return this.classify(url).domain;
  }

  getClassificationLabel(url: string | null | undefined): string {
    const result = this.classify(url);
    if (result.classification === 'STANDALONE_WEBSITE') {
      return 'Professional Website Available';
    }
    if (result.classification === 'SOCIAL_PROFILE') {
      return 'Social Media Profile';
    }
    if (result.classification === 'DIRECTORY_PROFILE') {
      return 'Directory Listing';
    }
    return 'No Website';
  }

  getDetectedPlatform(url: string | null | undefined): string | null {
    const classified = classifier.classifyWebsiteUrl(url);
    const socialKeys = Object.keys(classified.socialProfiles);
    if (socialKeys.length > 0) {
      return socialKeys[0].charAt(0).toUpperCase() + socialKeys[0].slice(1);
    }
    return null;
  }

  getLeadWebsiteFields(website: string | null | undefined): LeadWebsiteFields {
    const classified = classifier.classifyWebsiteUrl(website);
    const normalized = classified.normalizedUrl || (website || null);

    const websiteClassification = classified.websiteType === 'REAL_WEBSITE' ? 'business_website'
      : classified.websiteType === 'SOCIAL_PROFILE' ? 'social_profile'
      : classified.websiteType === 'GOOGLE_PROFILE' ? 'google_business_profile'
      : classified.websiteType === 'MARKETPLACE_PROFILE' || classified.websiteType === 'DIRECTORY_PROFILE' ? 'directory_listing'
      : 'no_website';

    const socialPlatforms = Object.keys(classified.socialProfiles);
    const primaryPlatform = socialPlatforms.length > 0 ? socialPlatforms[0] : undefined;

    return {
      website: normalized,
      websiteType: classified.websiteType,
      websiteClassification,
      websiteStatus: classified.websiteStatus,
      hasRealWebsite: classified.hasRealWebsite,
      websiteAuditAllowed: classified.hasRealWebsite,
      socialProfiles: classified.socialProfiles as unknown as Record<string, unknown>,
      socialPlatforms,
      ...(primaryPlatform ? { primaryPlatform } : {}),
    };
  }

  isRealWebsite(url: string | null | undefined): boolean {
    return classifier.isRealWebsite(url);
  }

  classifyWebsiteUrl(url: string | null | undefined): ClassifiedWebsite {
    return classifier.classifyWebsiteUrl(url);
  }

  isOnlineProfile(url: string | null | undefined): boolean {
    return classifier.isOnlineProfile(url);
  }

  getWebsiteClassification(url: string | null | undefined): ReturnType<typeof getWebsiteClassification> {
    return classifier.getWebsiteClassification(url);
  }

  setLeadClassificationFields(leadDoc: Record<string, unknown>, website: string | null | undefined): void {
    return classifier.setLeadClassificationFields(leadDoc, website);
  }
}

export const websiteClassificationService = new WebsiteClassificationService();
export { classifyWebsiteUrl, isRealWebsite, isOnlineProfile, getWebsiteClassification, setLeadClassificationFields };
export type { WebsiteClassificationType, ClassifiedWebsite, SocialProfiles, WCT as WebsiteClassificationTypeAlias };
