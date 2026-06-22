import { logger } from '../utils/logger';
import { ResponsiveAudit, UIUXAuditResult, ResponsiveScore, LayoutMetrics } from './types';

export class ResponsiveScoreEngine {
  calculateScores(
    responsiveAudit: ResponsiveAudit,
    uiuxAudit: UIUXAuditResult,
    _desktopMetrics: LayoutMetrics,
    mobileMetrics: LayoutMetrics
  ): ResponsiveScore {
    logger.info(`[ResponsiveScoreEngine] 🧮 Calculating scores...`);
    logger.info(`[ResponsiveScoreEngine] Input audit data: mobileFriendly=${responsiveAudit.mobileFriendly}, responsiveLayout=${responsiveAudit.responsiveLayout}, viewportMeta=${responsiveAudit.viewportMeta}, touchFriendly=${responsiveAudit.touchFriendly}, fontSizeIssues=${responsiveAudit.fontSizeIssues}`);
    logger.info(`[ResponsiveScoreEngine] Mobile metrics: horizontal=${mobileMetrics.hasHorizontalScroll}, offscreen=${mobileMetrics.elementsOffscreen}, fixed-width=${mobileMetrics.fixedWidthElements}`);
    logger.info(`[ResponsiveScoreEngine] UI/UX issues: ${uiuxAudit.issues.length} total (alignment=${uiuxAudit.alignmentIssues}, buttons=${uiuxAudit.brokenButtons}, overlap=${uiuxAudit.overlappingContent}, navigation=${uiuxAudit.navigationIssues})`);
    
    const responsiveScore = this.calculateResponsiveScore(responsiveAudit, mobileMetrics);
    const uiuxScore = this.calculateUIUXScore(uiuxAudit);
    const mobileExperienceScore = this.calculateMobileExperienceScore(
      responsiveAudit,
      uiuxAudit,
      mobileMetrics
    );

    logger.info(`[ResponsiveScoreEngine] ✅ Scores calculated: R=${responsiveScore}, UX=${uiuxScore}, Mobile=${mobileExperienceScore}`);

    return {
      responsiveScore,
      uiuxScore,
      mobileExperienceScore,
    };
  }

  private calculateResponsiveScore(audit: ResponsiveAudit, metrics: LayoutMetrics): number {
    let score = 100;

    if (!audit.viewportMeta) score -= 20;
    if (!audit.responsiveLayout) score -= 25;
    if (audit.horizontalScroll || metrics.hasHorizontalScroll) score -= 20;
    if (audit.overflowIssues) score -= 10;
    if (audit.fontSizeIssues) score -= 10;
    if (metrics.elementsOffscreen > 5) score -= Math.min(15, metrics.elementsOffscreen);
    if (metrics.fixedWidthElements > 3) score -= Math.min(10, metrics.fixedWidthElements * 2);

    return Math.max(0, Math.min(100, score));
  }

  private calculateUIUXScore(audit: UIUXAuditResult): number {
    let score = 100;

    const criticalIssues = audit.issues.filter(i => i.severity === 'critical').length;
    const warningIssues = audit.issues.filter(i => i.severity === 'warning').length;
    const infoIssues = audit.issues.filter(i => i.severity === 'info').length;

    score -= criticalIssues * 15;
    score -= warningIssues * 8;
    score -= infoIssues * 3;

    if (audit.alignmentIssues) score -= 5;
    if (audit.brokenButtons) score -= 10;
    if (audit.overlappingContent) score -= 10;
    if (audit.navigationIssues) score -= 8;
    if (audit.hiddenContent) score -= 5;
    if (audit.spacingIssues) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateMobileExperienceScore(
    audit: ResponsiveAudit,
    uiuxAudit: UIUXAuditResult,
    metrics: LayoutMetrics
  ): number {
    let score = 100;

    if (!audit.viewportMeta) score -= 25;
    if (!audit.touchFriendly) score -= 20;
    if (audit.fontSizeIssues) score -= 15;
    if (audit.horizontalScroll || metrics.hasHorizontalScroll) score -= 20;
    if (metrics.elementsOffscreen > 3) score -= 15;
    if (uiuxAudit.mobileLayoutBroken) score -= 20;

    const mobileIssues = uiuxAudit.issues.filter(
      i => i.type === 'touch-target' || i.type === 'font-size' || i.type === 'layout-break'
    );
    score -= mobileIssues.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  getScoreLevel(score: number): 'good' | 'medium' | 'poor' {
    if (score >= 80) return 'good';
    if (score >= 50) return 'medium';
    return 'poor';
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
  }

  getScoreRecommendation(score: number, type: 'responsive' | 'uiux' | 'mobile'): string {
    const level = this.getScoreLevel(score);
    
    if (type === 'responsive') {
      if (level === 'good') return 'Excellent responsive design';
      if (level === 'medium') return 'Responsive design needs improvements';
      return 'Poor responsive implementation - urgent fixes needed';
    }
    
    if (type === 'uiux') {
      if (level === 'good') return 'Great UI/UX quality';
      if (level === 'medium') return 'UI/UX has some issues to address';
      return 'Significant UI/UX problems detected';
    }
    
    if (type === 'mobile') {
      if (level === 'good') return 'Excellent mobile experience';
      if (level === 'medium') return 'Mobile experience could be improved';
      return 'Poor mobile experience - needs redesign';
    }
    
    return 'Unknown';
  }
}

export const responsiveScoreEngine = new ResponsiveScoreEngine();
