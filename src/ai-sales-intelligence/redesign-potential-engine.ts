import { logger } from '../utils/logger';

export class RedesignPotentialEngine {
  assess(input: {
    responsiveScore: number;
    uiuxScore: number;
    viewportMeta: boolean;
    mobileFriendly: boolean;
    horizontalScroll: boolean;
    copyrightYear: number | null;
    websiteFreshnessStatus: string;
    designGeneration: string;
    hasBrokenButtons: boolean;
    hasCroppedSections: boolean;
    hasNavigationIssues: boolean;
  }): 'low' | 'medium' | 'high' {
    try {
      let score = 0;

      if (input.responsiveScore < 50) score += 20;
      else if (input.responsiveScore < 70) score += 10;

      if (input.uiuxScore < 50) score += 20;
      else if (input.uiuxScore < 70) score += 10;

      if (!input.viewportMeta) score += 10;
      if (!input.mobileFriendly) score += 10;
      if (input.horizontalScroll) score += 10;

      if (input.websiteFreshnessStatus === 'very-outdated') score += 15;
      else if (input.websiteFreshnessStatus === 'outdated') score += 10;

      if (input.designGeneration === 'unknown' || input.designGeneration.includes('2018') || input.designGeneration.includes('old')) score += 10;

      if (input.hasBrokenButtons) score += 5;
      if (input.hasCroppedSections) score += 5;
      if (input.hasNavigationIssues) score += 5;

      const currentYear = new Date().getFullYear();
      if (input.copyrightYear && input.copyrightYear < currentYear - 2) score += 10;

      let result: 'low' | 'medium' | 'high';
      if (score >= 60) result = 'high';
      else if (score >= 30) result = 'medium';
      else result = 'low';

      logger.info(`Redesign potential: ${result} (score: ${score})`);
      return result;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to assess redesign potential:');
      return 'low';
    }
  }
}

export const redesignPotentialEngine = new RedesignPotentialEngine();
