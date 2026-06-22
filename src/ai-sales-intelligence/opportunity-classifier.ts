import { logger } from '../utils/logger';

export class OpportunityClassifier {
  classify(input: {
    redesignPotential: string;
    seoOpportunity: string;
    digitalMarketingOpportunity: string;
    conversionProbability: string;
    revenuePotential: string;
  }): 'low' | 'medium' | 'high' {
    try {
      let score = 0;

      const highValue = ['high', 'enterprise'];
      const mediumValue = ['medium'];

      if (highValue.includes(input.redesignPotential)) score += 20;
      else if (mediumValue.includes(input.redesignPotential)) score += 10;

      if (highValue.includes(input.seoOpportunity)) score += 15;
      else if (mediumValue.includes(input.seoOpportunity)) score += 8;

      if (highValue.includes(input.digitalMarketingOpportunity)) score += 15;
      else if (mediumValue.includes(input.digitalMarketingOpportunity)) score += 8;

      if (input.conversionProbability === 'high') score += 20;
      else if (input.conversionProbability === 'medium') score += 10;

      if (highValue.includes(input.revenuePotential)) score += 20;
      else if (mediumValue.includes(input.revenuePotential)) score += 10;

      let result: 'low' | 'medium' | 'high';
      if (score >= 60) result = 'high';
      else if (score >= 30) result = 'medium';
      else result = 'low';

      logger.info(`Opportunity classified: ${result} (score: ${score})`);
      return result;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to classify opportunity:');
      return 'low';
    }
  }
}

export const opportunityClassifier = new OpportunityClassifier();
