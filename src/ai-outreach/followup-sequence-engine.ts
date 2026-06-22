import { LeadInput, FollowUpEntry } from './ai-outreach.types';

export class FollowupSequenceEngine {
  generateSequence(lead: LeadInput): FollowUpEntry[] {
    return [
      this.generateFollowUp1(lead),
      this.generateFollowUp2(lead),
      this.generateFollowUp3(lead),
    ];
  }

  private generateFollowUp1(lead: LeadInput): FollowUpEntry {
    const issue = this.getPrimaryIssue(lead);
    return {
      stage: 1,
      type: 'email',
      subject: `Following up - ${lead.companyName}`,
      content: [
        `Hi ${lead.companyName} Team,`,
        '',
        `I wanted to follow up on my previous message about improving your digital presence.`,
        '',
        `We noticed ${issue}, and we believe we can help you address this effectively.`,
        '',
        `Would you have 10 minutes this week for a quick call to discuss?`,
        '',
        `Best regards,`,
        `LeadFinder Pro Team`,
      ].join('\n'),
      delayDays: 3,
    };
  }

  private generateFollowUp2(lead: LeadInput): FollowUpEntry {
    const valueProp = this.getValueProposition(lead);
    return {
      stage: 2,
      type: 'email',
      subject: `${lead.companyName} - Quick question`,
      content: [
        `Hi ${lead.companyName} Team,`,
        '',
        `Just checking in to see if you had a chance to review my previous message.`,
        '',
        `Here's what we can do for you:`,
        `${valueProp}`,
        '',
        `I've prepared a brief overview of our recommendations specifically for ${lead.companyName}.`,
        `Would you like me to share it with you?`,
        '',
        `Looking forward to your response,`,
        `LeadFinder Pro Team`,
      ].join('\n'),
      delayDays: 5,
    };
  }

  private generateFollowUp3(lead: LeadInput): FollowUpEntry {
    return {
      stage: 3,
      type: 'email',
      subject: `Final follow-up - ${lead.companyName}`,
      content: [
        `Hi ${lead.companyName} Team,`,
        '',
        `This is my final follow-up regarding our digital growth proposal.`,
        '',
        `We've helped numerous ${lead.category || 'business'} businesses in ${lead.address || 'your area'} ` +
        `achieve significant growth through improved digital presence.`,
        '',
        `If you're interested, we'd still love to help. Just reply to this email and we'll schedule a call.`,
        '',
        `If not, no worries at all — we wish you continued success!`,
        '',
        `Best regards,`,
        `LeadFinder Pro Team`,
      ].join('\n'),
      delayDays: 7,
    };
  }

  private getPrimaryIssue(lead: LeadInput): string {
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) return 'your website needs mobile optimization';
    if (lead.seoOpportunity === 'high') return 'your SEO can be significantly improved';
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) return 'your website quality needs improvement';
    if (lead.websiteFreshness?.status === 'outdated') return 'your website design is outdated';
    return 'there are opportunities to enhance your online presence';
  }

  private getValueProposition(lead: LeadInput): string {
    const services: string[] = [];
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 60) services.push('modern responsive design');
    if (lead.seoOpportunity === 'high') services.push('comprehensive SEO optimization');
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 60) services.push('website quality enhancement');
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) services.push('social media growth strategy');

    if (services.length === 0) {
      return '• A complete digital presence audit\n  • Custom growth strategy\n  • Performance optimization\n  • Ongoing support & monitoring';
    }

    return services.map(s => `  ✅ ${s.charAt(0).toUpperCase() + s.slice(1)}`).join('\n');
  }
}

export const followupSequenceEngine = new FollowupSequenceEngine();
