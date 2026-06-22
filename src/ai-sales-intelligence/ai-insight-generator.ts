import { logger } from '../utils/logger';

export class AIInsightGenerator {
  generate(input: {
    aiLeadScore: number;
    conversionProbability: string;
    websiteRedesignPotential: string;
    seoOpportunity: string;
    digitalMarketingOpportunity: string;
    revenuePotential: string;
    salesPriority: string;
    trustScore: number;
    aiLeadScoreOld: number | null;
  }): string {
    try {
      const parts: string[] = [];

      if (input.websiteRedesignPotential === 'high') {
        parts.push('Business has a poor website design that needs significant modernization.');
      } else if (input.websiteRedesignPotential === 'medium') {
        parts.push('Website design shows some age and could benefit from updates.');
      }

      if (input.seoOpportunity === 'high') {
        parts.push('SEO is weak or missing, creating a strong opportunity for search optimization services.');
      } else if (input.seoOpportunity === 'medium') {
        parts.push('SEO has some room for improvement and optimization.');
      }

      if (input.digitalMarketingOpportunity === 'high') {
        parts.push('Digital marketing presence is underdeveloped with significant growth potential.');
      } else if (input.digitalMarketingOpportunity === 'medium') {
        parts.push('Some digital marketing channels could be improved.');
      }

      if (input.conversionProbability === 'high') {
        parts.push('High probability of conversion - this lead is ready for sales engagement.');
      } else if (input.conversionProbability === 'medium') {
        parts.push('Moderate conversion probability - nurturing may be needed.');
      }

      if (input.revenuePotential === 'enterprise') {
        parts.push('Enterprise-level revenue potential detected.');
      } else if (input.revenuePotential === 'high') {
        parts.push('High revenue potential - prioritize for outreach.');
      }

      if (input.trustScore !== undefined && input.trustScore < 50) {
        parts.push('Low trust score indicates credibility gaps that our services can address.');
      }

      if (input.salesPriority === 'urgent') {
        parts.push('URGENT: High-priority lead requiring immediate sales action.');
      }

      if (parts.length === 0) {
        parts.push('Lead has adequate online presence. Focus on relationship building for upsell opportunities.');
      }

      let insight = parts.join(' ');

      if (input.aiLeadScore >= 70) {
        insight = `[HIGH-VALUE LEAD - Score: ${input.aiLeadScore}/100] ${insight}`;
      } else if (input.aiLeadScore >= 50) {
        insight = `[MODERATE-VALUE LEAD - Score: ${input.aiLeadScore}/100] ${insight}`;
      }

      logger.info(`AI insight generated (${parts.length} factors)`);
      return insight;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to generate AI insight:');
      return 'Standard lead with potential for digital services.';
    }
  }
}

export const aiInsightGenerator = new AIInsightGenerator();
