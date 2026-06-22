import { logger } from '../utils/logger';

export class DigitalMarketingOpportunityEngine {
  assess(input: {
    socialPresenceScore: number;
    hasFacebook: boolean;
    hasInstagram: boolean;
    hasLinkedin: boolean;
    hasTwitter: boolean;
    hasYoutube: boolean;
    hasContactForm: boolean;
    websiteFreshnessStatus: string;
    rating: number;
  }): 'low' | 'medium' | 'high' {
    try {
      let score = 0;

      if (input.socialPresenceScore < 20) score += 25;
      else if (input.socialPresenceScore < 40) score += 15;
      else if (input.socialPresenceScore < 60) score += 8;

      const platforms = [input.hasFacebook, input.hasInstagram, input.hasLinkedin, input.hasTwitter, input.hasYoutube];
      const activePlatforms = platforms.filter(Boolean).length;
      if (activePlatforms <= 1) score += 20;
      else if (activePlatforms <= 2) score += 10;

      if (!input.hasContactForm) score += 15;

      if (input.websiteFreshnessStatus === 'very-outdated' || input.websiteFreshnessStatus === 'outdated') score += 15;
      else if (input.websiteFreshnessStatus === 'moderate') score += 8;

      if (input.rating >= 4) score += 10;

      let result: 'low' | 'medium' | 'high';
      if (score >= 60) result = 'high';
      else if (score >= 30) result = 'medium';
      else result = 'low';

      logger.info(`Digital marketing opportunity: ${result} (score: ${score})`);
      return result;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to assess digital marketing opportunity:');
      return 'low';
    }
  }
}

export const digitalMarketingOpportunityEngine = new DigitalMarketingOpportunityEngine();
