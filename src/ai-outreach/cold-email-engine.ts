import { LeadInput, GeneratedEmail } from './ai-outreach.types';

export class ColdEmailEngine {
  generateWebsiteRedesignEmail(lead: LeadInput): GeneratedEmail {
    const issues = this.getWebsiteIssues(lead);
    const strengths = this.getStrengths(lead);
    const subject = `Improve Your ${lead.category || 'Business'} Website & Digital Presence`;

    const body = [
      `Hi ${lead.companyName} Team,`,
      '',
      `We analyzed your website and identified several opportunities for improvement:`,
      '',
      ...issues.map(i => `• ${i}`),
      '',
      strengths.length > 0 ? `On the positive side, your business has: ${strengths.join(', ')}.` : '',
      strengths.length > 0 ? '' : '',
      'We can help you with:',
      '✅ Modern website redesign with responsive layout',
      '✅ Mobile performance optimization',
      '✅ Improved user experience & conversion optimization',
      '✅ SEO-friendly architecture',
      '',
      'Would you like a free consultation to discuss how we can transform your digital presence?',
      '',
      'Looking forward to hearing from you,',
      'LeadFinder Pro Team',
    ].filter(l => l !== '').join('\n');

    return { type: 'website-redesign', subject, body };
  }

  generateSEOEmail(lead: LeadInput): GeneratedEmail {
    const issues = this.getSEOIssues(lead);
    const subject = `SEO Opportunities for ${lead.companyName}`;

    const body = [
      `Hi ${lead.companyName} Team,`,
      '',
      `We reviewed your online presence and found several SEO optimization opportunities:`,
      '',
      ...issues.map(i => `• ${i}`),
      '',
      'Our SEO services include:',
      '✅ On-page SEO optimization',
      '✅ Local SEO for better visibility in your area',
      '✅ Technical SEO improvements',
      '✅ Content strategy & optimization',
      '✅ Performance & speed optimization',
      '',
      'Would you like a free SEO audit report?',
      '',
      'Looking forward to hearing from you,',
      'LeadFinder Pro Team',
    ].join('\n');

    return { type: 'seo', subject, body };
  }

  generateDigitalMarketingEmail(lead: LeadInput): GeneratedEmail {
    const issues = this.getMarketingIssues(lead);
    const subject = `Digital Marketing Opportunities for ${lead.companyName}`;

    const body = [
      `Hi ${lead.companyName} Team,`,
      '',
      `We analyzed your digital presence and identified opportunities to grow your online reach:`,
      '',
      ...issues.map(i => `• ${i}`),
      '',
      'We offer comprehensive digital marketing services:',
      '✅ Search engine optimization (SEO)',
      '✅ Social media marketing & management',
      '✅ Google My Business optimization',
      '✅ Content marketing strategy',
      '✅ Paid advertising campaigns',
      '',
      'Would you like to discuss how we can help grow your business online?',
      '',
      'Looking forward to hearing from you,',
      'LeadFinder Pro Team',
    ].join('\n');

    return { type: 'digital-marketing', subject, body };
  }

  generatePerformanceEmail(lead: LeadInput): GeneratedEmail {
    const issues = this.getPerformanceIssues(lead);
    const subject = `Website Performance Optimization for ${lead.companyName}`;

    const body = [
      `Hi ${lead.companyName} Team,`,
      '',
      `We analyzed your website performance and found areas that need improvement:`,
      '',
      ...issues.map(i => `• ${i}`),
      '',
      'Our performance optimization services include:',
      '✅ Page speed optimization',
      '✅ Mobile responsiveness improvements',
      '✅ Core Web Vitals optimization',
      '✅ Image & asset optimization',
      '✅ Caching & CDN setup',
      '',
      'A faster website means better user experience and higher conversions.',
      'Would you like a free performance audit?',
      '',
      'Looking forward to hearing from you,',
      'LeadFinder Pro Team',
    ].join('\n');

    return { type: 'performance', subject, body };
  }

  generateAll(lead: LeadInput, types: string[]): GeneratedEmail[] {
    const emails: GeneratedEmail[] = [];
    if (types.includes('website-redesign') || types.length === 0) {
      emails.push(this.generateWebsiteRedesignEmail(lead));
    }
    if (types.includes('seo') || types.length === 0) {
      emails.push(this.generateSEOEmail(lead));
    }
    if (types.includes('digital-marketing') || types.length === 0) {
      emails.push(this.generateDigitalMarketingEmail(lead));
    }
    if (types.includes('performance') || types.length === 0) {
      emails.push(this.generatePerformanceEmail(lead));
    }
    return emails;
  }

  private getWebsiteIssues(lead: LeadInput): string[] {
    const issues: string[] = [];
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) {
      issues.push('Weak mobile responsiveness');
    }
    if (lead.responsiveAudit && !lead.responsiveAudit.responsiveLayout) {
      issues.push('Non-responsive layout design');
    }
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 50) {
      issues.push('Poor responsive design score');
    }
    if (lead.uiuxScore !== undefined && lead.uiuxScore < 50) {
      issues.push('Below average UI/UX quality');
    }
    if (lead.websiteFreshness?.status === 'outdated' || lead.websiteFreshness?.status === 'very-outdated') {
      issues.push('Outdated website design and technology');
    }
    if (lead.trustScore !== undefined && lead.trustScore < 40) {
      issues.push('Low trust signals on website');
    }
    if (issues.length === 0) {
      issues.push('Opportunities for design enhancement and modernization');
      issues.push('Room for improved user experience');
    }
    return issues;
  }

  private getSEOIssues(lead: LeadInput): string[] {
    const issues: string[] = [];
    if (lead.seoOpportunity === 'high') {
      issues.push('Strong potential for SEO improvement');
    }
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) {
      issues.push('Website quality affecting search rankings');
    }
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 50) {
      issues.push('Mobile responsiveness impacting SEO rankings');
    }
    if (lead.websiteFreshness?.status === 'outdated') {
      issues.push('Outdated website structure not optimized for search engines');
    }
    if (issues.length === 0) {
      issues.push('Opportunities to improve local SEO presence');
      issues.push('Room for better search engine visibility');
    }
    return issues;
  }

  private getMarketingIssues(lead: LeadInput): string[] {
    const issues: string[] = [];
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) {
      issues.push('Weak social media presence');
    }
    if (lead.socialAudit && !lead.socialAudit.instagram && !lead.socialAudit.facebook) {
      issues.push('Missing key social media platforms');
    }
    if (lead.digitalMarketingOpportunity === 'high') {
      issues.push('High potential for digital marketing growth');
    }
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) {
      issues.push('Digital presence quality needs improvement');
    }
    if (issues.length === 0) {
      issues.push('Opportunities to expand digital reach');
      issues.push('Room for improved online visibility');
    }
    return issues;
  }

  private getPerformanceIssues(lead: LeadInput): string[] {
    const issues: string[] = [];
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) {
      issues.push('Poor mobile performance and experience');
    }
    if (lead.responsiveAudit && !lead.responsiveAudit.touchFriendly) {
      issues.push('Touch interaction issues on mobile devices');
    }
    if (lead.mobileExperienceScore !== undefined && lead.mobileExperienceScore < 50) {
      issues.push('Below average mobile experience score');
    }
    if (lead.websiteFreshness?.status === 'outdated' || lead.websiteFreshness?.status === 'very-outdated') {
      issues.push('Outdated technology affecting performance');
    }
    if (issues.length === 0) {
      issues.push('Opportunities for performance optimization');
      issues.push('Room for improved loading speed');
    }
    return issues;
  }

  private getStrengths(lead: LeadInput): string[] {
    const strengths: string[] = [];
    if (lead.rating && lead.rating >= 4) strengths.push('strong customer ratings');
    if (lead.reviewsCount && lead.reviewsCount > 50) strengths.push('active customer engagement');
    if (lead.trustScore !== undefined && lead.trustScore >= 70) strengths.push('solid trust signals');
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore >= 60) strengths.push('decent social media presence');
    return strengths;
  }
}

export const coldEmailEngine = new ColdEmailEngine();
