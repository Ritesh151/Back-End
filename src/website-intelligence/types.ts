export interface WebsiteIntelligenceReport {
  trustScore: number
  trustScoreLevel: 'high' | 'medium' | 'low'
  qualityScore: number
  seoScore: number
  uiScore: number
  uxScore: number
  performanceScore: number
  accessibilityScore: number
  securityScore: number
  mobileScore: number
  businessOpportunityScore: number
  leadPriorityScore: number
  issues: IntelligenceIssue[]
  recommendations: IntelligenceRecommendation[]
  metaAnalysis: MetaAnalysis
  performanceMetrics: PerformanceMetrics
  securityDetails: SecurityDetails
  seoDetails: SEOAnalysis
  uiDetails: UIAnalysis
  contentAnalysis: ContentAnalysis
  categorySpecific: CategorySpecificAnalysis | null
  websiteHash: string
  analyzedAt: Date
  analysisDuration: number
  intelligenceCompleted: boolean
}

export interface IntelligenceIssue {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  description: string
  detail: string
  element?: string
  recommendation: string
}

export interface IntelligenceRecommendation {
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  category: string
}

export interface MetaAnalysis {
  title: string | null
  titleLength: number
  metaDescription: string | null
  descriptionLength: number
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  ogUrl: string | null
  twitterCard: string | null
  twitterTitle: string | null
  twitterDescription: string | null
  twitterImage: string | null
  canonical: string | null
  robots: string | null
  hasSchemaOrg: boolean
  hasJSONLD: boolean
  schemaTypes: string[]
  hreflang: string[]
  charset: string | null
  viewport: string | null
  themeColor: string | null
  favicon: boolean
  appleTouchIcon: boolean
}

export interface PerformanceMetrics {
  loadTime: number
  domContentLoaded: number
  domSize: number
  totalResources: number
  totalResourceSize: number
  imageCount: number
  imageSize: number
  scriptCount: number
  scriptSize: number
  cssCount: number
  cssSize: number
  fontCount: number
  hasLazyLoading: boolean
  hasMinifiedResources: boolean
  hasLargeImages: boolean
  largestContentfulPaint: number | null
  cumulativeLayoutShift: number | null
  firstInputDelay: number | null
}

export interface SecurityDetails {
  sslValid: boolean
  sslIssuer: string | null
  httpsRedirect: boolean
  hsts: boolean
  xFrameOptions: boolean
  xContentTypeOptions: boolean
  contentTypeSecurity: boolean
  hasCookieBanner: boolean
  formActionSecure: boolean
  mixedContent: boolean
}

export interface SEOAnalysis {
  hasSitemap: boolean
  hasRobotsTxt: boolean
  headingStructure: HeadingAnalysis
  internalLinks: LinkAnalysis
  externalLinks: LinkAnalysis
  imageAltTags: AltTagAnalysis
  structuredData: StructuredDataAnalysis
  contentQuality: ContentQualityAnalysis
  hasBrokenLinks: boolean
  brokenLinksCount: number
  hasDuplicateTitles: boolean
}

export interface HeadingAnalysis {
  h1Count: number
  h2Count: number
  h3Count: number
  hasSingleH1: boolean
  hierarchical: boolean
  hasEmptyHeadings: boolean
}

export interface LinkAnalysis {
  total: number
  working: number
  broken: number
  nofollowCount: number
}

export interface AltTagAnalysis {
  totalImages: number
  withAlt: number
  withoutAlt: number
  emptyAlt: number
}

export interface StructuredDataAnalysis {
  hasSchemaOrg: boolean
  hasJSONLD: boolean
  hasMicrodata: boolean
  hasOpenGraph: boolean
  hasTwitterCards: boolean
  types: string[]
}

export interface ContentQualityAnalysis {
  wordCount: number
  hasThinContent: boolean
  hasDuplicateContent: boolean
  hasReadableFont: boolean
  readingLevel: string
}

export interface UIAnalysis {
  modernDesign: boolean
  hasAnimations: boolean
  hasGoodTypography: boolean
  hasGoodColorContrast: boolean
  hasGoodWhitespace: boolean
  hasStickyHeader: boolean
  hasFooter: boolean
  hasNavigation: boolean
  hasCTAs: boolean
  ctaCount: number
  hasForms: boolean
  formCount: number
  hasSearch: boolean
  hasBreadcrumbs: boolean
  hasTestimonials: boolean
  hasSocialProof: boolean
  hasBlog: boolean
  hasPortfolio: boolean
  hasGallery: boolean
  hasFAQs: boolean
  hasLiveChat: boolean
  hasBackToTop: boolean
  hasCookieConsent: boolean
  touchTargetsValid: boolean
  mobileFriendly: boolean
  responsiveLayout: boolean
  viewportConfigured: boolean
}

export interface ContentAnalysis {
  hasBusinessEmail: boolean
  hasPhoneNumber: boolean
  hasAddress: boolean
  hasContactPage: boolean
  hasAboutPage: boolean
  hasPrivacyPolicy: boolean
  hasTermsPage: boolean
  hasGoogleMaps: boolean
  hasWhatsApp: boolean
  socialLinks: SocialLinkInfo[]
  ctaButtons: string[]
  navigationItems: string[]
  footerContent: string[]
  hasCopyright: boolean
  copyrightYear: number | null
}

export interface SocialLinkInfo {
  platform: string
  url: string
  found: boolean
}

export interface CategorySpecificAnalysis {
  category: string
  presentFeatures: string[]
  missingFeatures: string[]
  score: number
}

export interface IntelligenceAnalysisOptions {
  timeout?: number
  forceRefresh?: boolean
  category?: string
}
