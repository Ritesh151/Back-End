import { logger } from '../utils/logger';

export class SalesPriorityEngine {
  assess(input: {
    aiLeadScore: number;
    conversionProbability: string;
    websiteRedesignPotential: string;
    seoOpportunity: string;
    revenuePotential: string;
    trustScore: number;
    rating: number;
    reviewsCount: number;
  }): 'low' | 'medium' | 'high' | 'urgent' {
    try {
      let score = 0;

      if (input.conversionProbability === 'high') score += 25;
      else if (input.conversionProbability === 'medium') score += 10;

      if (input.websiteRedesignPotential === 'high') score += 20;
      else if (input.websiteRedesignPotential === 'medium') score += 10;

      if (input.seoOpportunity === 'high') score += 15;
      else if (input.seoOpportunity === 'medium') score += 8;

      if (input.revenuePotential === 'enterprise') score += 20;
      else if (input.revenuePotential === 'high') score += 15;
      else if (input.revenuePotential === 'medium') score += 8;

      if (input.aiLeadScore >= 70) score += 10;
      else if (input.aiLeadScore >= 50) score += 5;

      if (input.trustScore < 40) score += 10;
      if (input.rating >= 4 && input.reviewsCount > 20) score += 10;

      let result: 'low' | 'medium' | 'high' | 'urgent';
      if (score >= 80) result = 'urgent';
      else if (score >= 50) result = 'high';
      else if (score >= 25) result = 'medium';
      else result = 'low';

      logger.info(`Sales priority: ${result} (score: ${score})`);
      return result;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to assess sales priority:');
      return 'low';
    }
  }
}

export const salesPriorityEngine = new SalesPriorityEngine();
