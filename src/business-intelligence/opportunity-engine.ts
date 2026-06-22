import { logger } from '../utils/logger';
import { BusinessOpportunity, OpportunityFactors, TrustScore, WebsiteFreshness } from './types';

export class OpportunityEngine {
  detectOpportunity(
    factors: OpportunityFactors,
    _trustScore: TrustScore,
    websiteFreshness: WebsiteFreshness,
    _websiteQualityScore: number
  ): BusinessOpportunity {
    try {
      const reasons: string[] = [];
      let opportunityScore = 0;
      
      if (factors.poorSEO) {
        reasons.push('Poor SEO optimization');
        opportunityScore += 15;
      }
      
      if (factors.outdatedUI) {
        reasons.push('Outdated website design');
        opportunityScore += 20;
      }
      
      if (factors.missingResponsiveness) {
        reasons.push('Not mobile-responsive');
        opportunityScore += 15;
      }
      
      if (factors.weakSocialPresence) {
        reasons.push('Weak social media presence');
        opportunityScore += 10;
      }
      
      if (factors.noSSL) {
        reasons.push('No SSL certificate');
        opportunityScore += 10;
      }
      
      if (factors.noContactForm) {
        reasons.push('Missing contact form');
        opportunityScore += 10;
      }
      
      if (factors.outdatedCopyright) {
        reasons.push('Outdated copyright year');
        opportunityScore += 10;
      }
      
      if (factors.poorTrustScore) {
        reasons.push('Low trust score');
        opportunityScore += 15;
      }
      
      if (factors.lowQualityScore) {
        reasons.push('Overall low quality');
        opportunityScore += 15;
      }
      
      if (websiteFreshness.status === 'very-outdated') {
        reasons.push('Very outdated website');
        opportunityScore += 20;
      } else if (websiteFreshness.status === 'outdated') {
        reasons.push('Website needs refresh');
        opportunityScore += 10;
      }
      
      opportunityScore = Math.min(opportunityScore, 100);
      
      let level: BusinessOpportunity['level'];
      let estimatedValue: BusinessOpportunity['estimatedValue'];
      
      if (opportunityScore >= 70) {
        level = 'high';
        estimatedValue = 'high';
      } else if (opportunityScore >= 40) {
        level = 'medium';
        estimatedValue = 'medium';
      } else {
        level = 'low';
        estimatedValue = 'low';
      }
      
      const recommendation = this.generateRecommendation(reasons, level);

      const opportunity: BusinessOpportunity = {
        level,
        score: opportunityScore,
        reasons,
        recommendation,
        estimatedValue,
      };

      logger.info(`Opportunity detected: level=${level}, score=${opportunityScore}, reasons=${reasons.length}`);
      return opportunity;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to detect opportunity:');
      return this.getDefaultOpportunity();
    }
  }

  private generateRecommendation(reasons: string[], level: BusinessOpportunity['level']): string {
    if (level === 'high') {
      return `Strong redesign candidate with ${reasons.length} major improvement areas. High-value opportunity for comprehensive website modernization.`;
    } else if (level === 'medium') {
      return `Moderate opportunity with ${reasons.length} improvement areas. Consider targeted upgrades in specific areas.`;
    } else {
      return `Low priority opportunity. Website has ${reasons.length} minor issues but overall acceptable quality.`;
    }
  }

  private getDefaultOpportunity(): BusinessOpportunity {
    return {
      level: 'low',
      score: 0,
      reasons: [],
      recommendation: 'No significant opportunities detected',
      estimatedValue: 'low',
    };
  }
}

export const opportunityEngine = new OpportunityEngine();
