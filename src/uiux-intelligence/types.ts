export interface ResponsiveAudit {
  mobileFriendly: boolean;
  responsiveLayout: boolean;
  horizontalScroll: boolean;
  overflowIssues: boolean;
  viewportMeta: boolean;
  viewportContent: string | null;
  touchFriendly: boolean;
  fontSizeIssues: boolean;
}

export interface UIUXIssue {
  type: UIUXIssueType;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  element?: string;
  location?: string;
}

export type UIUXIssueType =
  | 'alignment'
  | 'overlap'
  | 'broken-button'
  | 'spacing'
  | 'cropped-section'
  | 'hidden-content'
  | 'broken-navigation'
  | 'unclickable-button'
  | 'font-size'
  | 'layout-break'
  | 'horizontal-scroll'
  | 'overflow'
  | 'viewport'
  | 'touch-target';

export interface UIUXAuditResult {
  alignmentIssues: boolean;
  brokenButtons: boolean;
  croppedSections: boolean;
  mobileLayoutBroken: boolean;
  overlappingContent: boolean;
  hiddenContent: boolean;
  navigationIssues: boolean;
  spacingIssues: boolean;
  issues: UIUXIssue[];
}

export interface ScreenshotData {
  desktopScreenshot: string | null;
  mobileScreenshot: string | null;
}

export interface ResponsiveScore {
  responsiveScore: number;
  uiuxScore: number;
  mobileExperienceScore: number;
}

export interface ViewportMetrics {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
}

export interface LayoutMetrics {
  hasHorizontalScroll: boolean;
  bodyOverflowX: boolean;
  elementsOffscreen: number;
  fixedWidthElements: number;
  overlappingElements: number;
}

export interface FullResponsiveAuditResult {
  responsiveAudit: ResponsiveAudit;
  uiuxAudit: UIUXAuditResult;
  screenshots: ScreenshotData;
  scores: ResponsiveScore;
  desktopMetrics: LayoutMetrics;
  mobileMetrics: LayoutMetrics;
  responsiveAuditCompleted: boolean;
  auditedAt: Date;
}

export interface ResponsiveAnalysisOptions {
  timeout?: number;
  skipScreenshots?: boolean;
  screenshotQuality?: number;
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

export const VIEWPORTS: Record<string, ViewportConfig> = {
  DESKTOP: {
    name: 'Desktop 1920x1080',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  MOBILE: {
    name: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};
