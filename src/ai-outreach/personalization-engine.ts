import { LeadInput } from './ai-outreach.types';

export class PersonalizationEngine {
  personalizeContent(lead: LeadInput, template: string): string {
    let result = template;
    result = result.replace(/{{companyName}}/g, lead.companyName);
    result = result.replace(/{{category}}/g, lead.category || 'business');
    result = result.replace(/{{industry}}/g, lead.industry || lead.category || 'business');
    result = result.replace(/{{location}}/g, lead.address || 'your area');
    result = result.replace(/{{rating}}/g, lead.rating ? `${lead.rating}/5` : 'N/A');
    result = result.replace(/{{trustScore}}/g, lead.trustScore?.toString() || 'N/A');
    result = result.replace(/{{qualityScore}}/g, lead.websiteQualityScore?.toString() || 'N/A');
    result = result.replace(/{{aiScore}}/g, lead.aiLeadScore?.toString() || 'N/A');
    return result;
  }

  getPrimaryPainPoints(lead: LeadInput): string[] {
    const points: string[] = [];
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) {
      points.push('website is not optimized for mobile devices');
    }
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 50) {
      points.push('responsive design needs significant improvement');
    }
    if (lead.seoOpportunity === 'high') {
      points.push('SEO structure is weak and needs optimization');
    }
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) {
      points.push('overall website quality is below industry standards');
    }
    if (lead.websiteFreshness?.status === 'outdated' || lead.websiteFreshness?.status === 'very-outdated') {
      points.push('website design and technology are outdated');
    }
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) {
      points.push('social media presence is minimal or missing');
    }
    if (lead.contactAudit && lead.contactAudit.contactMethods < 2) {
      points.push('limited contact options available to customers');
    }
    if (lead.footerAudit && (!lead.footerAudit.privacyPolicy || !lead.footerAudit.termsPage)) {
      points.push('missing important legal pages (privacy/terms)');
    }
    if (points.length === 0) {
      points.push('digital presence can be enhanced for better results');
    }
    return points;
  }

  getRecommendedServices(lead: LeadInput): string[] {
    const services: string[] = [];
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 60) {
      services.push('Responsive Website Redesign');
    }
    if (lead.seoOpportunity === 'high') {
      services.push('SEO Optimization');
    }
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 60) {
      services.push('Website Quality Improvement');
    }
    if (lead.websiteFreshness?.status === 'outdated' || lead.websiteFreshness?.status === 'very-outdated') {
      services.push('Modern Website Development');
    }
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) {
      services.push('Social Media Management');
    }
    if (lead.digitalMarketingOpportunity === 'high') {
      services.push('Digital Marketing Strategy');
    }
    if (lead.mobileExperienceScore !== undefined && lead.mobileExperienceScore < 60) {
      services.push('Mobile Performance Optimization');
    }
    if (lead.uiuxScore !== undefined && lead.uiuxScore < 60) {
      services.push('UI/UX Improvement');
    }
    if (services.length === 0) {
      services.push('Digital Presence Audit');
      services.push('Performance Optimization');
    }
    return services;
  }

  getDigitalMaturity(lead: LeadInput): 'basic' | 'developing' | 'advanced' {
    let score = 0;
    if (lead.responsiveScore !== undefined && lead.responsiveScore > 50) score += 20;
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore > 50) score += 20;
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore > 50) score += 20;
    if (lead.trustScore !== undefined && lead.trustScore > 50) score += 20;
    if (lead.websiteFreshness?.modernStandards) score += 20;
    if (score >= 60) return 'advanced';
    if (score >= 30) return 'developing';
    return 'basic';
  }
}

export const personalizationEngine = new PersonalizationEngine();
