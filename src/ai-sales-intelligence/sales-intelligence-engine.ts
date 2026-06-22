import { ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import {
  SalesIntelligenceReport,
  SalesAnalysisOptions,
  CompetitorContext,
  LeadScoreInput,
} from './types';
import { leadScoreEngine } from './lead-score-engine';
import { conversionPredictor } from './conversion-predictor';
import { redesignPotentialEngine } from './redesign-potential-engine';
import { seoOpportunityEngine } from './seo-opportunity-engine';
import { revenuePredictor } from './revenue-predictor';
import { salesPriorityEngine } from './sales-priority-engine';
import { opportunityClassifier } from './opportunity-classifier';
import { aiInsightGenerator } from './ai-insight-generator';
import { competitorAnalysisEngine } from './competitor-analysis-engine';
import { digitalMarketingOpportunityEngine } from './digital-marketing-opportunity-engine';

export class SalesIntelligenceEngine {
  async analyze(
    lead: ILead,
    competitorContext?: CompetitorContext,
    _options: SalesAnalysisOptions = {}
  ): Promise<SalesIntelligenceReport> {
    try {
      logger.info(`Starting AI sales intelligence analysis for lead ${lead._id}`);

      const scoreInput: LeadScoreInput = {
        seoScore: lead.responsiveScore || 0,
        uiuxScore: lead.uiuxScore || 0,
        responsiveScore: lead.responsiveScore || 0,
        trustScore: lead.trustScore || 0,
        socialPresenceScore: lead.socialPresenceScore || 0,
        websiteQualityScore: lead.websiteQualityScore || 0,
        websiteFreshnessStatus: lead.websiteFreshness?.status || 'unknown',
        hasContactForm: lead.contactAudit?.contactForm || false,
        hasPhone: lead.contactAudit?.phoneDetected || !!lead.phone,
        hasEmail: lead.contactAudit?.emailDetected || !!lead.email,
        rating: lead.rating || 0,
        reviewsCount: lead.reviewsCount || 0,
      };

      const aiLeadScore = leadScoreEngine.calculateScore(scoreInput);

      const redesignPotential = redesignPotentialEngine.assess({
        responsiveScore: lead.responsiveScore || 0,
        uiuxScore: lead.uiuxScore || 0,
        viewportMeta: lead.responsiveAudit?.viewportMeta || false,
        mobileFriendly: lead.responsiveAudit?.mobileFriendly || false,
        horizontalScroll: lead.responsiveAudit?.horizontalScroll || false,
        copyrightYear: lead.copyrightYear || null,
        websiteFreshnessStatus: lead.websiteFreshness?.status || 'unknown',
        designGeneration: lead.websiteFreshness?.designGeneration || 'unknown',
        hasBrokenButtons: lead.uiuxAudit?.brokenButtons || false,
        hasCroppedSections: lead.uiuxAudit?.croppedSections || false,
        hasNavigationIssues: lead.uiuxAudit?.navigationIssues || false,
      });

      const seoOpportunity = seoOpportunityEngine.assess({
        seoScore: lead.responsiveScore || 0,
        metaTitle: lead.metaTitle || null,
        metaDescription: lead.metaDescription || null,
        hasContactPage: lead.hasContactPage || false,
        sslEnabled: lead.sslEnabled || false,
        responseTime: lead.responseTime || 0,
      });

      const digitalMarketingOpportunity = digitalMarketingOpportunityEngine.assess({
        socialPresenceScore: lead.socialPresenceScore || 0,
        hasFacebook: lead.socialAudit?.facebook || false,
        hasInstagram: lead.socialAudit?.instagram || false,
        hasLinkedin: lead.socialAudit?.linkedin || false,
        hasTwitter: lead.socialAudit?.twitter || false,
        hasYoutube: lead.socialAudit?.youtube || false,
        hasContactForm: lead.contactAudit?.contactForm || false,
        websiteFreshnessStatus: lead.websiteFreshness?.status || 'unknown',
        rating: lead.rating || 0,
      });

      const conversionProbability = conversionPredictor.predict({
        responsiveScore: lead.responsiveScore || 0,
        uiuxScore: lead.uiuxScore || 0,
        trustScore: lead.trustScore || 0,
        seoOpportunity: seoOpportunity,
        redesignPotential: redesignPotential,
        websiteFreshnessStatus: lead.websiteFreshness?.status || 'unknown',
        socialPresenceScore: lead.socialPresenceScore || 0,
      });

      const revenuePotential = revenuePredictor.predict({
        rating: lead.rating || 0,
        reviewsCount: lead.reviewsCount || 0,
        websiteQualityScore: lead.websiteQualityScore || 0,
        socialPresenceScore: lead.socialPresenceScore || 0,
        category: lead.category || null,
        area: lead.searchedArea || null,
        leadScore: aiLeadScore,
      });

      const salesPriority = salesPriorityEngine.assess({
        aiLeadScore,
        conversionProbability,
        websiteRedesignPotential: redesignPotential,
        seoOpportunity: seoOpportunity,
        revenuePotential: revenuePotential,
        trustScore: lead.trustScore || 0,
        rating: lead.rating || 0,
        reviewsCount: lead.reviewsCount || 0,
      });

      opportunityClassifier.classify({
        redesignPotential,
        seoOpportunity,
        digitalMarketingOpportunity,
        conversionProbability,
        revenuePotential,
      });

      const aiInsight = aiInsightGenerator.generate({
        aiLeadScore,
        conversionProbability,
        websiteRedesignPotential: redesignPotential,
        seoOpportunity: seoOpportunity,
        digitalMarketingOpportunity,
        revenuePotential,
        salesPriority,
        trustScore: lead.trustScore || 0,
        aiLeadScoreOld: lead.aiLeadScore || null,
      });

      let competitionLevel: 'low' | 'medium' | 'high' = 'medium';
      let marketOpportunity: 'low' | 'medium' | 'high' = 'medium';

      if (competitorContext) {
        const competitorResult = competitorAnalysisEngine.analyze({
          ...competitorContext,
          leadScore: aiLeadScore,
          trustScore: lead.trustScore || 0,
        });
        competitionLevel = competitorResult.competitionLevel;
        marketOpportunity = competitorResult.marketOpportunity;
      }

      const report: SalesIntelligenceReport = {
        aiLeadScore,
        conversionProbability,
        websiteRedesignPotential: redesignPotential,
        seoOpportunity: seoOpportunity,
        digitalMarketingOpportunity,
        revenuePotential,
        salesPriority,
        aiInsight,
        competitionLevel,
        marketOpportunity,
        analyzedAt: new Date(),
        salesIntelligenceCompleted: true,
      };

      logger.info(`Sales intelligence completed: score=${aiLeadScore}, priority=${salesPriority}, conversion=${conversionProbability}`);
      return report;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Sales intelligence analysis failed for lead ${lead._id}:`);
      return this.getDefaultReport();
    }
  }

  private getDefaultReport(): SalesIntelligenceReport {
    return {
      aiLeadScore: 0,
      conversionProbability: 'low',
      websiteRedesignPotential: 'low',
      seoOpportunity: 'low',
      digitalMarketingOpportunity: 'low',
      revenuePotential: 'low',
      salesPriority: 'low',
      aiInsight: 'Analysis incomplete',
      competitionLevel: 'medium',
      marketOpportunity: 'medium',
      analyzedAt: new Date(),
      salesIntelligenceCompleted: false,
    };
  }
}

export const salesIntelligenceEngine = new SalesIntelligenceEngine();
