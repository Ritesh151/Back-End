import { logger } from '../utils/logger';

export class CompetitorAnalysisEngine {
  analyze(context: {
    totalLeadsInSameArea: number;
    totalLeadsInSameCategory: number;
    averageScoreInCategory: number;
    averageTrustScoreInCategory: number;
    leadScore: number;
    trustScore: number;
  }): { competitionLevel: 'low' | 'medium' | 'high'; marketOpportunity: 'low' | 'medium' | 'high' } {
    try {
      let competitionScore = 0;
      let opportunityScore = 0;

      if (context.totalLeadsInSameArea > 50) competitionScore += 30;
      else if (context.totalLeadsInSameArea > 20) competitionScore += 20;
      else if (context.totalLeadsInSameArea > 10) competitionScore += 10;

      if (context.totalLeadsInSameCategory > 30) competitionScore += 20;
      else if (context.totalLeadsInSameCategory > 10) competitionScore += 10;

      if (context.leadScore > context.averageScoreInCategory) competitionScore += 10;
      else competitionScore += 20;

      if (context.averageScoreInCategory < 40) opportunityScore += 30;
      else if (context.averageScoreInCategory < 60) opportunityScore += 20;
      else if (context.averageScoreInCategory < 80) opportunityScore += 10;

      if (context.trustScore > context.averageTrustScoreInCategory) opportunityScore += 15;
      else if (context.trustScore < context.averageTrustScoreInCategory - 20) opportunityScore += 25;

      let competitionLevel: 'low' | 'medium' | 'high';
      if (competitionScore >= 50) competitionLevel = 'high';
      else if (competitionScore >= 25) competitionLevel = 'medium';
      else competitionLevel = 'low';

      let marketOpportunity: 'low' | 'medium' | 'high';
      if (opportunityScore >= 40) marketOpportunity = 'high';
      else if (opportunityScore >= 20) marketOpportunity = 'medium';
      else marketOpportunity = 'low';

      logger.info(`Competitor analysis: competition=${competitionLevel}, market=${marketOpportunity}`);
      return { competitionLevel, marketOpportunity };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to analyze competition:');
      return { competitionLevel: 'medium', marketOpportunity: 'medium' };
    }
  }
}

export const competitorAnalysisEngine = new CompetitorAnalysisEngine();
