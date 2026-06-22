import { LeadInput, OutreachScoreResult } from './ai-outreach.types';

export class OutreachScoreEngine {
  calculate(lead: LeadInput): OutreachScoreResult {
    const aiLeadScore = lead.aiLeadScore || 0;
    const websiteQuality = lead.websiteQualityScore || 0;
    const socialPresence = lead.socialPresenceScore || 0;
    const reviewsActivity = this.calculateReviewsScore(lead.rating || 0, lead.reviewsCount || 0);
    const digitalMaturity = this.calculateDigitalMaturity(lead);

    const rawScore = (
      aiLeadScore * 0.25 +
      websiteQuality * 0.2 +
      socialPresence * 0.15 +
      reviewsActivity * 0.15 +
      digitalMaturity * 0.25
    );

    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    let probability: 'low' | 'medium' | 'high';
    if (score >= 70) probability = 'high';
    else if (score >= 40) probability = 'medium';
    else probability = 'low';

    return {
      outreachProbability: probability,
      outreachProbabilityScore: score,
      factors: {
        aiLeadScore,
        websiteQuality,
        socialPresence,
        reviewsActivity,
        digitalMaturity,
      },
    };
  }

  private calculateReviewsScore(rating: number, count: number): number {
    let score = 0;
    if (rating >= 4.5) score += 40;
    else if (rating >= 4) score += 30;
    else if (rating >= 3) score += 15;
    if (count >= 100) score += 60;
    else if (count >= 50) score += 45;
    else if (count >= 20) score += 30;
    else if (count >= 5) score += 15;
    return score;
  }

  private calculateDigitalMaturity(lead: LeadInput): number {
    let score = 0;
    if (lead.responsiveAudit?.mobileFriendly) score += 15;
    if (lead.responsiveAudit?.responsiveLayout) score += 10;
    if (lead.responsiveAudit?.viewportMeta) score += 5;
    if (lead.websiteFreshness?.modernStandards) score += 15;
    if (lead.footerAudit?.privacyPolicy) score += 5;
    if (lead.footerAudit?.termsPage) score += 5;
    if (lead.contactAudit?.contactForm) score += 10;
    if (lead.contactAudit?.phoneDetected && lead.contactAudit?.emailDetected) score += 10;
    if (lead.socialAudit?.facebook) score += 5;
    if (lead.socialAudit?.instagram) score += 5;
    if (lead.socialAudit?.linkedin) score += 5;
    if (lead.trustScore !== undefined && lead.trustScore >= 50) score += 10;
    return Math.min(100, score * 5);
  }
}

export const outreachScoreEngine = new OutreachScoreEngine();
