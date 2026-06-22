import { logger } from '../utils/logger';
import { classifyWebsiteUrl } from '../modules/leads/services/urlClassifier.service';

export interface WebsiteAnalysisResult {
  hasWebsite: boolean;
  websiteUrl: string | null;
  normalizedDomain: string | null;
  websiteType: 'BUSINESS_WEBSITE' | 'ONLINE_PROFILE' | 'NO_WEBSITE';
  analysisEligible: boolean;
}

function extractDomain(url: string): string | null {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const hostname = new URL(normalized).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export class WebsiteAnalysisService {
  analyze(websiteUrl: string | null | undefined): WebsiteAnalysisResult {
    if (!websiteUrl) {
      logger.info('[WebsiteAnalysis] No URL provided');
      return {
        hasWebsite: false,
        websiteUrl: null,
        normalizedDomain: null,
        websiteType: 'NO_WEBSITE',
        analysisEligible: false,
      };
    }

    const classified = classifyWebsiteUrl(websiteUrl);
    const domain = extractDomain(websiteUrl);

    if (classified.hasRealWebsite) {
      logger.info({ websiteUrl, domain }, '[WebsiteAnalysis] Website Detected');
      logger.info({ websiteUrl, domain }, '[WebsiteAnalysis] Website Normalized');
      logger.info({ websiteUrl, domain }, '[WebsiteAnalysis] Website Classified — BUSINESS_WEBSITE');
      logger.info({ websiteUrl, domain }, '[WebsiteAnalysis] Analysis Eligible — true');

      return {
        hasWebsite: true,
        websiteUrl: classified.normalizedUrl || websiteUrl,
        normalizedDomain: domain,
        websiteType: 'BUSINESS_WEBSITE',
        analysisEligible: true,
      };
    }

    const isSocialOrProfile =
      classified.websiteType === 'SOCIAL_PROFILE' ||
      classified.websiteType === 'GOOGLE_PROFILE' ||
      classified.websiteType === 'MARKETPLACE_PROFILE' ||
      classified.websiteType === 'DIRECTORY_PROFILE';

    if (isSocialOrProfile) {
      logger.info({ websiteUrl, domain }, '[WebsiteAnalysis] Classified — ONLINE_PROFILE (non-business)');
      return {
        hasWebsite: false,
        websiteUrl: classified.normalizedUrl || websiteUrl,
        normalizedDomain: domain,
        websiteType: 'ONLINE_PROFILE',
        analysisEligible: false,
      };
    }

    logger.info({ websiteUrl }, '[WebsiteAnalysis] Classified — NO_WEBSITE');
    return {
      hasWebsite: false,
      websiteUrl: null,
      normalizedDomain: null,
      websiteType: 'NO_WEBSITE',
      analysisEligible: false,
    };
  }

  getLeadFields(websiteUrl: string | null | undefined): {
    website: string | null;
    hasWebsite: boolean;
    normalizedDomain: string | null;
    websiteType: string;
    analysisEligible: boolean;
    hasRealWebsite: boolean;
    websiteAuditAllowed: boolean;
  } {
    const result = this.analyze(websiteUrl);

    const classified = classifyWebsiteUrl(websiteUrl);

    return {
      website: result.websiteUrl,
      hasWebsite: result.hasWebsite,
      normalizedDomain: result.normalizedDomain,
      websiteType: classified.websiteType,
      analysisEligible: result.analysisEligible,
      hasRealWebsite: result.analysisEligible,
      websiteAuditAllowed: result.analysisEligible,
    };
  }

  resolveLead(lead: {
    website?: string | null;
  }): WebsiteAnalysisResult {
    return this.analyze(lead.website);
  }
}

export const websiteAnalysisService = new WebsiteAnalysisService();
