import type { ILead } from '../../models/Lead';
import type { AuditSummary, WebsiteReportType } from './report.types';
import { websiteAnalysisService } from '../../services/website-analysis.service';

function getSocialProfiles(lead: ILead): Record<string, string> {
  return (lead.socialProfiles as Record<string, string> | undefined) || {};
}

function getSocialLinks(lead: ILead): Record<string, string | string[]> {
  return (lead.socialLinks as Record<string, string | string[]> | undefined) || {};
}

function classifyWebsiteType(lead: ILead): { type: WebsiteReportType; hasRealWebsite: boolean; platforms: string[] } {
  const platforms: string[] = [];

  if (lead.socialPlatforms && lead.socialPlatforms.length > 0) {
    platforms.push(...lead.socialPlatforms);
  }

  const analysis = websiteAnalysisService.resolveLead(lead);

  if (analysis.analysisEligible) {
    return { type: 'standalone', hasRealWebsite: true, platforms };
  }

  const url = lead.website || '';
  if (!url) {
    return { type: 'no_website', hasRealWebsite: false, platforms };
  }

  if (analysis.hasWebsite) {
    return { type: 'social_only', hasRealWebsite: false, platforms };
  }

  return { type: 'no_website', hasRealWebsite: false, platforms };
}

function getSocialOnlyPlatforms(lead: ILead): string[] {
  const platforms: string[] = [];
  const socialProfiles = getSocialProfiles(lead);
  for (const [key, val] of Object.entries(socialProfiles)) {
    if (val && typeof val === 'string') platforms.push(key);
  }
  const socialLinks = getSocialLinks(lead);
  for (const [key, val] of Object.entries(socialLinks)) {
    if (Array.isArray(val)) {
      if (val.length > 0) platforms.push(key);
    } else if (val) {
      platforms.push(key);
    }
  }
  return [...new Set(platforms)];
}

function getOpportunityReasons(lead: ILead): string[] {
  const reasons: string[] = [];
  const opp = lead.businessOpportunity;
  if (opp?.reasons && Array.isArray(opp.reasons)) {
    reasons.push(...opp.reasons);
  }
  if (lead.hasRealWebsite === false || lead.websiteType !== 'REAL_WEBSITE') {
    reasons.push('No standalone website detected - missed digital presence opportunity');
  }
  if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) {
    reasons.push('Low website quality score indicates need for redesign');
  }
  if (lead.trustScore !== undefined && lead.trustScore < 50) {
    reasons.push('Low trust score affects customer confidence');
  }
  if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 30) {
    reasons.push('Weak social media presence limits reach');
  }
  if (reasons.length === 0) {
    reasons.push('Potential for improved digital presence identified');
  }
  return [...new Set(reasons)];
}

function getConversionLimitations(lead: ILead): string[] {
  const limitations: string[] = [];
  if (!lead.hasRealWebsite) {
    limitations.push('Cannot control user experience without a website');
    limitations.push('Limited ability to capture leads and conversions');
    limitations.push('No platform for SEO-driven organic discovery');
    limitations.push('Dependent on third-party platform algorithms');
  }
  if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) {
    limitations.push('Website is not mobile-friendly');
  }
  if (!lead.hasContactPage && lead.hasRealWebsite) {
    limitations.push('No dedicated contact page found');
  }
  return limitations;
}

function getSeoOpportunity(lead: ILead): string {
  if (lead.seoOpportunity) {
    const map: Record<string, string> = {
      low: 'Basic SEO foundation exists but needs improvement',
      medium: 'Moderate SEO opportunity - room for significant organic growth',
      high: 'High SEO opportunity - website can achieve strong organic rankings',
    };
    return map[lead.seoOpportunity] || 'SEO opportunity exists';
  }
  return 'SEO analysis available upon audit';
}

function getRedesignPotential(lead: ILead): string {
  if (lead.websiteRedesignPotential) {
    const map: Record<string, string> = {
      low: 'Current design is adequate for business needs',
      medium: 'Moderate redesign opportunity - visual refresh would help',
      high: 'High redesign potential - website needs modern upgrade',
    };
    return map[lead.websiteRedesignPotential] || 'Design assessment available';
  }
  return 'Design analysis available upon audit';
}

function getDigitalMarketingOpportunity(lead: ILead): string {
  if (lead.digitalMarketingOpportunity) {
    const map: Record<string, string> = {
      low: 'Limited digital marketing opportunity',
      medium: 'Moderate digital marketing potential',
      high: 'Strong digital marketing opportunity identified',
    };
    return map[lead.digitalMarketingOpportunity] || 'Digital marketing potential exists';
  }
  return 'Digital marketing analysis available upon audit';
}

function getRecommendation(lead: ILead): string {
  const rec = lead.aiRecommendation;
  if (rec?.summary) return rec.summary;

  if (!lead.hasRealWebsite) {
    return 'This business would benefit significantly from establishing a standalone website to enhance credibility, control brand perception, and capture organic leads.';
  }

  if (lead.trustScore !== undefined && lead.trustScore < 50) {
    return 'Prioritize improving website trust signals - add privacy policy, terms of service, and clear contact information.';
  }

  if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) {
    return 'Website quality needs improvement - consider redesign with modern UI patterns, faster loading, and better mobile experience.';
  }

  return 'Continue building digital presence with focus on SEO optimization and content marketing.';
}

export function buildAuditSummary(lead: ILead): AuditSummary {
  const classification = classifyWebsiteType(lead);
  const socialPlatforms = classification.type === 'social_only'
    ? getSocialOnlyPlatforms(lead)
    : (lead.socialPlatforms || []);

  const ra = lead.responsiveAudit;
  const ua = lead.uiuxAudit;
  const opp = lead.businessOpportunity;

  return {
    companyName: lead.companyName || 'Unknown Business',
    website: lead.website || null,
    phone: lead.phone || null,
    email: lead.email || null,
    address: lead.address || null,
    category: lead.category || null,
    rating: lead.rating ?? null,
    reviewsCount: lead.reviewsCount ?? null,
    leadScore: lead.leadScore || 0,
    websiteType: classification.type,
    hasRealWebsite: classification.hasRealWebsite,
    socialPlatforms,
    primaryPlatform: lead.primaryPlatform || (socialPlatforms.length > 0 ? socialPlatforms[0] : null),

    responsiveAudit: {
      score: lead.responsiveScore ?? null,
      mobileFriendly: ra?.mobileFriendly ?? null,
      responsiveLayout: ra?.responsiveLayout ?? null,
      viewportMeta: ra?.viewportMeta ?? null,
      touchFriendly: ra?.touchFriendly ?? null,
      fontSizeIssues: ra?.fontSizeIssues ?? null,
      horizontalScroll: ra?.horizontalScroll ?? null,
      overflowIssues: ra?.overflowIssues ?? null,
      uiuxScore: lead.uiuxScore ?? null,
      mobileScore: lead.mobileExperienceScore ?? null,
      desktopScreenshot: lead.desktopScreenshot || null,
      mobileScreenshot: lead.mobileScreenshot || null,
      issues: (ua?.issues as Array<{ type: string; severity: string; description: string }>) || [],
    },

    seoAudit: {
      metaTitle: lead.metaTitle || null,
      metaDescription: lead.metaDescription || null,
      sslEnabled: lead.sslEnabled ?? null,
      responseTime: lead.responseTime ?? null,
      hasContactPage: lead.hasContactPage ?? null,
    },

    businessIntelligence: {
      trustScore: lead.trustScore ?? null,
      trustScoreLevel: lead.trustScoreLevel || null,
      websiteQualityScore: lead.websiteQualityScore ?? null,
      socialPresenceScore: lead.socialPresenceScore ?? null,
      opportunityScore: opp?.score ?? null,
      opportunityLevel: opp?.level || null,
      opportunityReasons: getOpportunityReasons(lead),
      opportunityRecommendation: opp?.recommendation || null,
      redesignPotential: getRedesignPotential(lead),
      seoOpportunity: getSeoOpportunity(lead),
      digitalMarketingOpportunity: getDigitalMarketingOpportunity(lead),
      conversionProbability: lead.conversionProbability || null,
      revenuePotential: lead.revenuePotential || null,
      salesPriority: lead.salesPriority || null,
      competitionLevel: lead.competitionLevel || null,
      marketOpportunity: lead.marketOpportunity || null,
      aiSummary: lead.aiSummary || null,
      aiWeaknesses: lead.aiWeaknesses || [],
      aiOpportunities: lead.aiOpportunities || [],
      aiRecommendation: getRecommendation(lead),
      freshness: {
        status: lead.websiteFreshness?.status || null,
        copyrightYear: lead.websiteFreshness?.copyrightYear ?? null,
        designGeneration: lead.websiteFreshness?.designGeneration || null,
      },
      socialAudit: {
        instagram: lead.socialAudit?.instagram || false,
        facebook: lead.socialAudit?.facebook || false,
        linkedin: lead.socialAudit?.linkedin || false,
        youtube: lead.socialAudit?.youtube || false,
        whatsapp: lead.socialAudit?.whatsapp || false,
        detectedLinks: lead.socialAudit?.detectedLinks || [],
      },
      contactAudit: {
        phoneDetected: lead.contactAudit?.phoneDetected || false,
        emailDetected: lead.contactAudit?.emailDetected || false,
        contactForm: lead.contactAudit?.contactForm || false,
        contactMethods: lead.contactAudit?.contactMethods || 0,
      },
    },

    outreach: {
      probability: lead.outreachProbability || null,
      probabilityScore: lead.outreachProbabilityScore ?? null,
      sampleEmail: lead.generatedEmails && lead.generatedEmails.length > 0
        ? lead.generatedEmails[0].body : null,
      sampleWhatsApp: lead.generatedWhatsAppMessages && lead.generatedWhatsAppMessages.length > 0
        ? lead.generatedWhatsAppMessages[0].content : null,
    },

    socialOnlyAnalysis: classification.type !== 'standalone' ? {
      isSocialOnly: true,
      socialMediaPresence: socialPlatforms.length > 0 ? socialPlatforms : ['No social profiles detected'],
      brandingPotential: classification.type === 'social_only'
        ? 'Limited - social platforms do not offer full brand control'
        : 'Significant - standalone website enables complete brand ownership',
      credibilityImpact: classification.type === 'no_website'
        ? 'Low - businesses without websites are perceived as less credible'
        : 'Medium - social-only presence limits professional perception',
      conversionLimitations: getConversionLimitations(lead),
      recommendation: 'Build a standalone website to establish credibility, control brand narrative, and capture organic traffic through SEO.',
      missingWebsiteOpportunity: classification.hasRealWebsite
        ? ''
        : 'This business is missing out on significant digital opportunities by not having a standalone website. A dedicated website would enable brand control, SEO visibility, lead capture, and professional credibility.',
    } : null,
  };
}
