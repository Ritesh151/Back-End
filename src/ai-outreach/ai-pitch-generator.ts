import { LeadInput } from './ai-outreach.types';

export class AIPitchGenerator {
  generateSalesPitch(lead: LeadInput): string {
    const strengths = this.getStrengths(lead);
    const weaknesses = this.getWeaknesses(lead);
    const maturity = this.getMaturityLabel(lead);

    return [
      `Sales Pitch for ${lead.companyName}`,
      '',
      `Business Profile: ${lead.category || 'Business'} | Digital Maturity: ${maturity}`,
      '',
      `Overview:`,
      `${lead.companyName} is a ${lead.category || 'business'} ${lead.address ? `in ${lead.address}` : 'in your area'} ` +
      `${lead.rating ? `with a rating of ${lead.rating}/5 (${lead.reviewsCount || 0} reviews)` : ''}. ` +
      `${lead.aiSummary ? lead.aiSummary : 'The business has potential for digital growth.'}`,
      '',
      `Key Strengths:`,
      ...strengths.map(s => `✓ ${s}`),
      '',
      `Areas for Improvement:`,
      ...weaknesses.map(w => `→ ${w}`),
      '',
      `Recommended Approach:`,
      this.getRecommendedApproach(lead),
      '',
      `Expected Outcome:`,
      this.getExpectedOutcome(lead),
    ].join('\n');
  }

  generateQuickPitch(lead: LeadInput): string {
    const topIssue = this.getTopIssue(lead);
    return `${lead.companyName}: ${lead.category || 'Business'} with ${topIssue}. ` +
      `${this.getMaturityLabel(lead)} digital maturity. ` +
      `Recommend ${this.getServiceFocus(lead)}.`;
  }

  private getStrengths(lead: LeadInput): string[] {
    const strengths: string[] = [];
    if (lead.rating && lead.rating >= 4) strengths.push('Strong customer ratings and reviews');
    if (lead.reviewsCount && lead.reviewsCount > 50) strengths.push('Active customer engagement with many reviews');
    if (lead.trustScore !== undefined && lead.trustScore >= 70) strengths.push('High trust signals on website');
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore >= 60) strengths.push('Decent social media presence');
    if (lead.responsiveScore !== undefined && lead.responsiveScore >= 70) strengths.push('Good responsive design');
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore >= 70) strengths.push('Solid website quality');
    if (lead.aiLeadScore !== undefined && lead.aiLeadScore >= 70) strengths.push('High AI-assessed lead potential');
    if (strengths.length === 0) strengths.push('Established local business presence');
    return strengths;
  }

  private getWeaknesses(lead: LeadInput): string[] {
    const weaknesses: string[] = [];
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) weaknesses.push('Mobile responsiveness needs attention');
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 50) weaknesses.push('Poor responsive design score');
    if (lead.seoOpportunity === 'high') weaknesses.push('Significant SEO improvement opportunity');
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) weaknesses.push('Below average website quality');
    if (lead.websiteFreshness?.status === 'outdated') weaknesses.push('Outdated website technology');
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) weaknesses.push('Weak social media footprint');
    if (weaknesses.length === 0) weaknesses.push('Room for digital presence enhancement');
    return weaknesses;
  }

  private getMaturityLabel(lead: LeadInput): string {
    if (lead.aiLeadScore !== undefined) {
      if (lead.aiLeadScore >= 70) return 'Advanced';
      if (lead.aiLeadScore >= 40) return 'Developing';
    }
    if (lead.trustScore !== undefined) {
      if (lead.trustScore >= 70) return 'Advanced';
      if (lead.trustScore >= 40) return 'Developing';
    }
    return 'Basic';
  }

  private getTopIssue(lead: LeadInput): string {
    if (lead.responsiveAudit && !lead.responsiveAudit.mobileFriendly) return 'mobile optimization needs';
    if (lead.seoOpportunity === 'high') return 'SEO improvement potential';
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) return 'website quality gaps';
    if (lead.websiteFreshness?.status === 'outdated') return 'outdated digital presence';
    return 'digital growth opportunities';
  }

  private getServiceFocus(lead: LeadInput): string {
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 50) return 'responsive redesign';
    if (lead.seoOpportunity === 'high') return 'SEO optimization';
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 50) return 'website quality improvement';
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) return 'social media growth';
    return 'comprehensive digital strategy';
  }

  private getRecommendedApproach(lead: LeadInput): string {
    const services: string[] = [];
    if (lead.responsiveScore !== undefined && lead.responsiveScore < 60) services.push('responsive redesign');
    if (lead.seoOpportunity === 'high') services.push('SEO optimization');
    if (lead.websiteQualityScore !== undefined && lead.websiteQualityScore < 60) services.push('website quality improvement');
    if (lead.socialPresenceScore !== undefined && lead.socialPresenceScore < 40) services.push('social media setup & management');
    if (lead.websiteFreshness?.status === 'outdated') services.push('modern website development');

    if (services.length === 0) {
      return 'Start with a comprehensive digital audit to identify specific improvement areas, then implement a phased approach beginning with the highest-impact changes.';
    }

    return `Focus on ${services.slice(0, 2).join(' and ')}${services.length > 2 ? ', with additional improvements in ' + services.slice(2).join(', ') : ''}. This phased approach ensures quick wins while building toward comprehensive digital transformation.`;
  }

  private getExpectedOutcome(lead: LeadInput): string {
    const strengths = this.getStrengths(lead);
    if (strengths.length > 2) {
      return 'With your existing strong foundation, we expect to see significant improvements in traffic, engagement, and conversion within 8-12 weeks of implementation.';
    }
    return 'With our proven methodology, we expect to see measurable improvements in online visibility, lead generation, and customer engagement within 12-16 weeks.';
  }
}

export const aiPitchGenerator = new AIPitchGenerator();
