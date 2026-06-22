import { LeadInput, GeneratedWhatsAppMessage } from './ai-outreach.types';

export class WhatsAppMessageEngine {
  generateShortPitch(lead: LeadInput): GeneratedWhatsAppMessage {
    const issue = this.getPrimaryIssue(lead);
    const content = [
      `Hi ${lead.companyName} 👋`,
      '',
      `We reviewed your website and found ${issue.toLowerCase()}.`,
      '',
      `Would you like a free website audit report? We'll show you exactly how to improve your online presence.`,
      '',
      `Let us know if you're interested!`,
    ].join('\n');

    return { type: 'short-pitch', content };
  }

  generateMediumPitch(lead: LeadInput): GeneratedWhatsAppMessage {
    const issues = this.getTopIssues(lead, 2);
    const content = [
      `Hi ${lead.companyName} Team 👋`,
      '',
      `We analyzed your digital presence and found several growth opportunities:`,
      '',
      ...issues.map(i => `➤ ${i}`),
      '',
      `We specialize in helping businesses like yours improve their online presence.`,
      `Would you be open to a quick 10-minute call to discuss how we can help?`,
      '',
      `Looking forward to connecting!`,
    ].join('\n');

    return { type: 'medium-pitch', content };
  }

  generateAggressivePitch(lead: LeadInput): GeneratedWhatsAppMessage {
    const issues = this.getTopIssues(lead, 3);
    const opportunity = lead.businessOpportunity?.level === 'high' ? 'high-value opportunity' : 'growth opportunity';
    const content = [
      `Hi ${lead.companyName} 👋`,
      '',
      `${lead.companyName} is a ${opportunity} but your digital presence is holding you back:`,
      '',
      ...issues.map(i => `❌ ${i}`),
      '',
      `We've helped similar businesses increase their online reach by 3-5x.`,
      `Let's schedule a free strategy call this week.`,
      '',
      `Reply "YES" and I'll send you a proposal.`,
    ].join('\n');

    return { type: 'aggressive', content };
  }

  generateFriendlyOutreach(lead: LeadInput): GeneratedWhatsAppMessage {
    const strengths = this.getStrengths(lead);
    const content = [
      `Hey ${lead.companyName} 👋`,
      '',
      `Hope you're doing well!`,
      '',
      `We came across ${lead.companyName} and noticed ${strengths.length > 0 ? `you're doing great with ${strengths[0]}` : 'your business has great potential'}.`,
      '',
      `We help businesses enhance their digital presence and would love to see if we can help you grow even more.`,
      '',
      `No pressure at all — just wanted to start a conversation! 😊`,
    ].join('\n');

    return { type: 'friendly', content };
  }

  generateAll(lead: LeadInput, types: string[]): GeneratedWhatsAppMessage[] {
    const messages: GeneratedWhatsAppMessage[] = [];
    const typeSet = new Set(types);
    if (typeSet.size === 0 || typeSet.has('short-pitch')) messages.push(this.generateShortPitch(lead));
    if (typeSet.size === 0 || typeSet.has('medium-pitch')) messages.push(this.generateMediumPitch(lead));
    if (typeSet.size === 0 || typeSet.has('aggressive')) messages.push(this.generateAggressivePitch(lead));
    if (typeSet.size === 0 || typeSet.has('friendly')) messages.push(this.generateFriendlyOutreach(lead));
    return messages;
  }

  private getPrimaryIssue(lead: LeadInput): string {
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) return 'mobile responsiveness needs improvement';
    if (lead.seoOpportunity === 'high') return 'SEO optimization opportunities were identified';
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) return 'website quality can be significantly improved';
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 50) return 'responsive design needs work';
    return 'opportunities for digital improvement';
  }

  private getTopIssues(lead: LeadInput, count: number): string[] {
    const issues: string[] = [];
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) issues.push('Mobile responsiveness issues');
    if (lead.responsiveAudit && !lead.responsiveAudit.responsiveLayout) issues.push('Non-responsive layout');
    if (lead.seoOpportunity === 'high') issues.push('SEO optimization needed');
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) issues.push('Poor website quality score');
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 50) issues.push('Low responsive design score');
    if (lead.websiteFreshness?.status === 'outdated') issues.push('Outdated website design');
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) issues.push('Weak social media presence');
    if (issues.length === 0) issues.push('Digital presence can be enhanced');
    return issues.slice(0, count);
  }

  private getStrengths(lead: LeadInput): string[] {
    const strengths: string[] = [];
    if (lead.rating && lead.rating >= 4) strengths.push('customer satisfaction');
    if (lead.trustScore !== undefined && lead.trustScore >= 70) strengths.push('building trust online');
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore >= 60) strengths.push('social media engagement');
    return strengths;
  }
}

export const whatsappMessageEngine = new WhatsAppMessageEngine();
