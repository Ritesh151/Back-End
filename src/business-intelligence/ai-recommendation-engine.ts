import { logger } from '../utils/logger';
import { AIRecommendation, BusinessOpportunity, OpportunityFactors, WebsiteQualityScore } from './types';

export class AIRecommendationEngine {
  generateRecommendation(
    opportunity: BusinessOpportunity,
    factors: OpportunityFactors,
    qualityScore: WebsiteQualityScore
  ): AIRecommendation {
    try {
      const services: string[] = [];
      const keyIssues: string[] = [];
      
      if (factors.poorSEO) {
        services.push('SEO Optimization');
        keyIssues.push('Poor search engine visibility');
      }
      
      if (factors.outdatedUI || factors.missingResponsiveness) {
        services.push('Website Redesign');
        keyIssues.push('Outdated or non-responsive design');
      }
      
      if (factors.weakSocialPresence) {
        services.push('Social Media Marketing');
        keyIssues.push('Limited social media engagement');
      }
      
      if (factors.noSSL) {
        services.push('SSL Certificate Setup');
        keyIssues.push('Security concerns - no HTTPS');
      }
      
      if (factors.noContactForm) {
        services.push('Contact Form Integration');
        keyIssues.push('Missing lead capture mechanisms');
      }
      
      if (factors.poorTrustScore) {
        services.push('Trust Building Elements');
        keyIssues.push('Low credibility indicators');
      }
      
      if (qualityScore.breakdown.performance < 60) {
        services.push('Performance Optimization');
        keyIssues.push('Slow page load times');
      }
      
      const summary = this.generateSummary(opportunity, services, keyIssues);
      const estimatedImpact = this.estimateImpact(opportunity.level, services.length);
      
      const recommendation: AIRecommendation = {
        summary,
        services: [...new Set(services)],
        priority: opportunity.level,
        estimatedImpact,
        keyIssues,
      };

      logger.info(`AI recommendation generated: services=${services.length}, priority=${opportunity.level}`);
      return recommendation;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to generate AI recommendation:');
      return this.getDefaultRecommendation();
    }
  }

  private generateSummary(
    opportunity: BusinessOpportunity,
    services: string[],
    issues: string[]
  ): string {
    if (opportunity.level === 'high') {
      return `This business has ${issues.length} critical areas for improvement including ${issues.slice(0, 3).join(', ')}. Strong candidate for comprehensive ${services.slice(0, 2).join(' + ')} services with high ROI potential.`;
    } else if (opportunity.level === 'medium') {
      return `Moderate improvement opportunities identified across ${issues.length} areas. Targeted ${services.slice(0, 2).join(' and ')} would enhance online presence and conversion potential.`;
    } else {
      return `Website shows acceptable quality with ${issues.length} minor enhancement opportunities. Consider ${services[0] || 'maintenance services'} for incremental improvements.`;
    }
  }

  private estimateImpact(level: BusinessOpportunity['level'], serviceCount: number): string {
    if (level === 'high' && serviceCount >= 4) {
      return 'High impact - Comprehensive improvements could significantly boost online presence, lead generation, and business credibility';
    } else if (level === 'high') {
      return 'High impact - Major improvements in key areas would substantially enhance business performance';
    } else if (level === 'medium') {
      return 'Medium impact - Targeted improvements would provide measurable enhancements to online effectiveness';
    } else {
      return 'Low impact - Minor optimizations may provide incremental benefits';
    }
  }

  private getDefaultRecommendation(): AIRecommendation {
    return {
      summary: 'No significant recommendations at this time',
      services: [],
      priority: 'low',
      estimatedImpact: 'Minimal impact expected',
      keyIssues: [],
    };
  }
}

export const aiRecommendationEngine = new AIRecommendationEngine();
