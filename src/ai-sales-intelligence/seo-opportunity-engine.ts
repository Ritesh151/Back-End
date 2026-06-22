import { logger } from '../utils/logger';

export class SEOOpportunityEngine {
  assess(input: {
    seoScore: number;
    metaTitle: string | null;
    metaDescription: string | null;
    hasContactPage: boolean;
    sslEnabled: boolean;
    responseTime: number;
  }): 'low' | 'medium' | 'high' {
    try {
      let score = 0;

      if (input.seoScore < 40 || input.seoScore === 0) score += 20;
      else if (input.seoScore < 60) score += 10;

      if (!input.metaTitle) score += 15;
      if (!input.metaDescription) score += 15;
      if (!input.hasContactPage) score += 10;
      if (!input.sslEnabled) score += 15;

      if (input.responseTime > 3000) score += 10;
      else if (input.responseTime > 1000) score += 5;

      let result: 'low' | 'medium' | 'high';
      if (score >= 50) result = 'high';
      else if (score >= 25) result = 'medium';
      else result = 'low';

      logger.info(`SEO opportunity: ${result} (score: ${score})`);
      return result;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to assess SEO opportunity:');
      return 'low';
    }
  }
}

export const seoOpportunityEngine = new SEOOpportunityEngine();
