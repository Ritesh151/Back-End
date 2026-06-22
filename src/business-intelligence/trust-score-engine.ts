import { logger } from '../utils/logger';
import { TrustScore, FooterAnalysis, SocialAudit, ContactAudit, WebsiteFreshness } from './types';

export class TrustScoreEngine {
  calculateTrustScore(
    sslEnabled: boolean,
    footerAnalysis: FooterAnalysis,
    socialAudit: SocialAudit,
    contactAudit: ContactAudit,
    websiteFreshness: WebsiteFreshness,
    seoScore: number,
    responsiveScore: number
  ): TrustScore {
    try {
      let score = 0;
      
      const factors = {
        ssl: sslEnabled,
        contactPresence: contactAudit.contactMethods >= 2,
        socialPresence: socialAudit.socialPresenceScore >= 40,
        seoQuality: seoScore >= 60,
        responsiveness: responsiveScore >= 70,
        copyrightFresh: !websiteFreshness.staleCopyright,
        businessTransparency: footerAnalysis.footerComplete,
      };
      
      if (factors.ssl) score += 20;
      if (factors.contactPresence) score += 15;
      if (factors.socialPresence) score += 15;
      if (factors.seoQuality) score += 10;
      if (factors.responsiveness) score += 10;
      if (factors.copyrightFresh) score += 15;
      if (factors.businessTransparency) score += 15;
      
      if (footerAnalysis.privacyPolicy) score += 5;
      if (footerAnalysis.termsPage) score += 5;
      if (contactAudit.contactForm) score += 5;
      if (contactAudit.googleMapsEmbed) score += 5;
      
      score = Math.min(score, 100);
      
      let level: TrustScore['level'];
      if (score >= 75) {
        level = 'high';
      } else if (score >= 50) {
        level = 'medium';
      } else {
        level = 'low';
      }

      const trustScore: TrustScore = {
        score,
        level,
        factors,
      };

      logger.info(`Trust score calculated: ${score} (${level})`);
      return trustScore;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to calculate trust score:');
      return this.getDefaultTrustScore();
    }
  }

  private getDefaultTrustScore(): TrustScore {
    return {
      score: 0,
      level: 'low',
      factors: {
        ssl: false,
        contactPresence: false,
        socialPresence: false,
        seoQuality: false,
        responsiveness: false,
        copyrightFresh: false,
        businessTransparency: false,
      },
    };
  }
}

export const trustScoreEngine = new TrustScoreEngine();
