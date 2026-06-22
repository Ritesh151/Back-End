export type WebsiteClassification = 'business_website' | 'social_profile' | 'google_business_profile' | 'directory_listing' | 'no_website';

import { classifyWebsiteUrl } from '../modules/leads/services/urlClassifier.service';
export type { WebsiteClassificationType, SocialProfiles, ClassifiedWebsite } from '../modules/leads/services/urlClassifier.service';

export function detectPlatform(url: string): string | null {
  const result = classifyWebsiteUrl(url);
  if (result.websiteType === 'SOCIAL_PROFILE') {
    const socialKeys = Object.keys(result.socialProfiles);
    return socialKeys.length > 0 ? socialKeys[0] : null;
  }
  return null;
}

export function isSocialUrl(url: string): boolean {
  return classifyWebsiteUrl(url).websiteType === 'SOCIAL_PROFILE';
}

export function isMarketplaceUrl(url: string): boolean {
  return classifyWebsiteUrl(url).websiteType === 'MARKETPLACE_PROFILE';
}

export function isMapsUrl(url: string): boolean {
  return classifyWebsiteUrl(url).websiteType === 'GOOGLE_PROFILE';
}

export function isRealBusinessWebsite(url: string): boolean {
  return classifyWebsiteUrl(url).hasRealWebsite;
}

export function classifyWebsite(url: string): {
  hasRealWebsite: boolean;
  websiteType: 'business' | 'social' | 'marketplace' | 'maps' | 'unknown';
  socialPlatform: string | undefined;
  websiteClassification: WebsiteClassification;
  websiteAuditAllowed: boolean;
} {
  const result = classifyWebsiteUrl(url);
  const mappedType = result.websiteType === 'REAL_WEBSITE' ? 'business'
    : result.websiteType === 'SOCIAL_PROFILE' ? 'social'
    : result.websiteType === 'GOOGLE_PROFILE' ? 'maps'
    : result.websiteType === 'MARKETPLACE_PROFILE' || result.websiteType === 'DIRECTORY_PROFILE' ? 'marketplace'
    : 'unknown';

  const mappedClassification: WebsiteClassification = result.websiteType === 'REAL_WEBSITE' ? 'business_website'
    : result.websiteType === 'SOCIAL_PROFILE' ? 'social_profile'
    : result.websiteType === 'GOOGLE_PROFILE' ? 'google_business_profile'
    : result.websiteType === 'MARKETPLACE_PROFILE' || result.websiteType === 'DIRECTORY_PROFILE' ? 'directory_listing'
    : 'no_website';

  const socialKeys = Object.keys(result.socialProfiles);
  const socialPlatform = socialKeys.length > 0 ? socialKeys[0] : undefined;

  return {
    hasRealWebsite: result.hasRealWebsite,
    websiteType: mappedType,
    socialPlatform,
    websiteClassification: mappedClassification,
    websiteAuditAllowed: result.hasRealWebsite,
  };
}
