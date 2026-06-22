import { logger } from '../utils/logger';
import { LeadScoreInput } from './types';

export class LeadScoreEngine {
  calculateScore(input: LeadScoreInput): number {
    try {
      let score = 0;
      const weights = {
        seo: 15,
        uiux: 15,
        responsive: 15,
        trust: 15,
        social: 10,
        quality: 10,
        freshness: 5,
        contact: 5,
        activity: 10,
      };

      if (input.seoScore > 0) score += (input.seoScore / 100) * weights.seo;
      if (input.uiuxScore > 0) score += (input.uiuxScore / 100) * weights.uiux;
      if (input.responsiveScore > 0) score += (input.responsiveScore / 100) * weights.responsive;
      if (input.trustScore > 0) score += (input.trustScore / 100) * weights.trust;
      if (input.socialPresenceScore > 0) score += (input.socialPresenceScore / 100) * weights.social;
      if (input.websiteQualityScore > 0) score += (input.websiteQualityScore / 100) * weights.quality;

      if (input.websiteFreshnessStatus === 'fresh') score += weights.freshness;
      else if (input.websiteFreshnessStatus === 'moderate') score += weights.freshness * 0.5;

      const contactMethods = [input.hasContactForm, input.hasPhone, input.hasEmail].filter(Boolean).length;
      score += (contactMethods / 3) * weights.contact;

      const activityScore = Math.min(input.rating * 10, 5) + Math.min(input.reviewsCount / 10, 5);
      score += (activityScore / 10) * weights.activity;

      const finalScore = Math.round(Math.min(100, Math.max(0, score)));
      logger.info(`AI lead score calculated: ${finalScore}`);
      return finalScore;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to calculate lead score:');
      return 0;
    }
  }
}

export const leadScoreEngine = new LeadScoreEngine();
