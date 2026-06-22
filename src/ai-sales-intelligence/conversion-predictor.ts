import { logger } from '../utils/logger';

export class ConversionPredictor {
  predict(input: {
    responsiveScore: number;
    uiuxScore: number;
    trustScore: number;
    seoOpportunity: string;
    redesignPotential: string;
    websiteFreshnessStatus: string;
    socialPresenceScore: number;
  }): 'low' | 'medium' | 'high' {
    try {
      let score = 0;

      if (input.responsiveScore < 50) score += 20;
      else if (input.responsiveScore < 70) score += 10;

      if (input.uiuxScore < 50) score += 20;
      else if (input.uiuxScore < 70) score += 10;

      if (input.trustScore < 40) score += 15;
      else if (input.trustScore < 60) score += 8;

      if (input.seoOpportunity === 'high') score += 15;
      else if (input.seoOpportunity === 'medium') score += 8;

      if (input.redesignPotential === 'high') score += 15;
      else if (input.redesignPotential === 'medium') score += 8;

      if (input.websiteFreshnessStatus === 'outdated' || input.websiteFreshnessStatus === 'very-outdated') score += 10;

      if (input.socialPresenceScore < 30) score += 5;

      let result: 'low' | 'medium' | 'high';
      if (score >= 60) result = 'high';
      else if (score >= 30) result = 'medium';
      else result = 'low';

      logger.info(`Conversion probability: ${result} (score: ${score})`);
      return result;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to predict conversion:');
      return 'low';
    }
  }
}

export const conversionPredictor = new ConversionPredictor();
