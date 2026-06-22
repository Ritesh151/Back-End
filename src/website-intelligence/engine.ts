import { chromium, Browser, Page } from 'playwright'
import { createHash } from 'crypto'
import { logger } from '../utils/logger'
import type {
  WebsiteIntelligenceReport,
  IntelligenceIssue,
  IntelligenceRecommendation,
  MetaAnalysis,
  PerformanceMetrics,
  SecurityDetails,
  SEOAnalysis,
  ContentAnalysis,
  UIAnalysis,
  SocialLinkInfo,
  CategorySpecificAnalysis,
  IntelligenceAnalysisOptions,
} from './types'

const SOCIAL_PLATFORMS: Record<string, RegExp> = {
  facebook: /facebook\.com/i,
  instagram: /instagram\.com/i,
  linkedin: /linkedin\.com/i,
  twitter: /twitter\.com|x\.com/i,
  youtube: /youtube\.com/i,
  whatsapp: /wa\.me|whatsapp\.com/i,
}

const CATEGORY_FEATURES: Record<string, { present: string[]; missing: string[] }> = {
  restaurant: {
    present: ['menu', 'reservation', 'online ordering', 'delivery', 'location', 'opening hours', 'gallery'],
    missing: [],
  },
  hotel: {
    present: ['booking', 'rooms', 'amenities', 'gallery', 'location', 'contact'],
    missing: [],
  },
  gym: {
    present: ['membership', 'trainer', 'pricing', 'timings', 'facilities'],
    missing: [],
  },
  'web agency': {
    present: ['portfolio', 'services', 'testimonials', 'pricing', 'contact'],
    missing: [],
  },
  spa: {
    present: ['services', 'pricing', 'booking', 'gallery', 'location', 'timings'],
    missing: [],
  },
  dental: {
    present: ['services', 'doctors', 'appointment', 'location', 'timings', 'insurance'],
    missing: [],
  },
}

function normalizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null
  let normalized = url.trim()
  if (!normalized.match(/^https?:\/\//i)) normalized = 'https://' + normalized
  try { new URL(normalized); return normalized }
  catch { return null }
}

function preventSSRF(url: string): void {
  const parsedUrl = new URL(url)
  const hostname = parsedUrl.hostname.toLowerCase()
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254']
  if (blocked.includes(hostname)) throw new Error('Access to local hosts is not allowed')
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.'))
    throw new Error('Access to private networks is not allowed')
}

function computeWebsiteHash(html: string, css: string, js: string): string {
  return createHash('md5').update(html.substring(0, 10000) + css.substring(0, 5000) + js.substring(0, 5000)).digest('hex')
}

export class WebsiteIntelligenceEngine {
  private browser: Browser | null = null

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      })
      logger.info('Website intelligence engine browser initialized')
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      logger.info('Website intelligence engine browser closed')
    }
  }

  async analyzeWebsite(url: string, options: IntelligenceAnalysisOptions = {}): Promise<WebsiteIntelligenceReport> {
    const startTime = Date.now()
    const timeout = options.timeout || 90000

    try {
      await this.initialize()
      if (!this.browser) throw new Error('Browser not initialized')

      const normalizedUrl = normalizeUrl(url)
      if (!normalizedUrl) throw new Error('Invalid URL')

      preventSSRF(normalizedUrl)

      logger.info(`Starting website intelligence analysis for ${normalizedUrl}`)

      const page: Page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      try {
        const perfMetrics = await this.collectPerformanceMetrics(page, normalizedUrl, timeout)
        const { html, css, js } = perfMetrics
        const websiteHash = computeWebsiteHash(html, css, js)

        const metaAnalysis = await this.analyzeMeta(page, html)
        const securityDetails = await this.analyzeSecurity(page, normalizedUrl)
        const seoDetails = this.analyzeSEO(html, page)
        const uiDetails = this.analyzeUI(html, page)
        const contentAnalysis = this.analyzeContent(html)
        const categorySpecific = options.category ? this.analyzeCategory(html, options.category) : null
        const issues = this.detectIssues(metaAnalysis, perfMetrics, securityDetails, seoDetails, uiDetails, contentAnalysis, categorySpecific)
        const recommendations = this.generateRecommendations(issues, contentAnalysis)

        const scores = this.calculateScores(metaAnalysis, perfMetrics, securityDetails, seoDetails, uiDetails, contentAnalysis, issues)

        const analysisDuration = Date.now() - startTime
        logger.info(`Website intelligence completed for ${normalizedUrl} in ${analysisDuration}ms`)

        return {
          trustScore: scores.trustScore,
          trustScoreLevel: scores.trustScore >= 70 ? 'high' : scores.trustScore >= 40 ? 'medium' : 'low',
          qualityScore: scores.qualityScore,
          seoScore: scores.seoScore,
          uiScore: scores.uiScore,
          uxScore: scores.uxScore,
          performanceScore: scores.performanceScore,
          accessibilityScore: scores.accessibilityScore,
          securityScore: scores.securityScore,
          mobileScore: scores.mobileScore,
          businessOpportunityScore: scores.businessOpportunityScore,
          leadPriorityScore: scores.leadPriorityScore,
          issues,
          recommendations,
          metaAnalysis,
          performanceMetrics: perfMetrics,
          securityDetails,
          seoDetails,
          uiDetails,
          contentAnalysis,
          categorySpecific,
          websiteHash,
          analyzedAt: new Date(),
          analysisDuration,
          intelligenceCompleted: true,
        }
      } finally {
        await page.close()
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Website intelligence analysis failed for ${url}:`)
      return this.getDefaultReport()
    }
  }

  private async collectPerformanceMetrics(
    page: Page, url: string, timeout: number
  ): Promise<PerformanceMetrics & { html: string; css: string; js: string }> {
    let html = ''
    let css = ''
    let js = ''

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout })
      await page.waitForTimeout(1500)

      html = await page.content()
      const perf = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        return {
          loadTime: nav ? nav.duration : 0,
          domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
          domSize: document.querySelectorAll('*').length,
          totalResources: performance.getEntriesByType('resource').length,
          totalResourceSize: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).reduce((s, r) => s + (r.transferSize || 0), 0),
          imageCount: document.querySelectorAll('img').length,
          scriptCount: document.querySelectorAll('script').length,
          cssCount: document.querySelectorAll('link[rel="stylesheet"]').length,
          fontCount: document.querySelectorAll('link[rel="preload"][as="font"], link[rel="stylesheet"][href*="font"]').length,
          hasLazyLoading: document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').length > 0,
          hasMinifiedResources: document.querySelectorAll('script[src*=".min."], link[href*=".min."]').length > 0,
          largestContentfulPaint: null as number | null,
          cumulativeLayoutShift: null as number | null,
          firstInputDelay: null as number | null,
        }
      })

      const imageSize = await page.evaluate(() => {
        let total = 0
        document.querySelectorAll('img').forEach(img => {
          const src = (img as HTMLImageElement).src
          if (src) total += src.length
        })
        return total
      })

      const scriptSize = await page.evaluate(() => {
        let total = 0
        document.querySelectorAll('script[src]').forEach(s => {
          const src = (s as HTMLScriptElement).src
          if (src) total += src.length
        })
        return total
      })

      const allCSS = await page.evaluate(() => {
        let cssText = ''
        document.querySelectorAll('style').forEach(s => { cssText += (s as HTMLStyleElement).textContent || '' })
        return cssText
      })
      css = allCSS

      const allJS = await page.evaluate(() => {
        let jsText = ''
        document.querySelectorAll('script:not([src])').forEach(s => { jsText += (s as HTMLScriptElement).textContent || '' })
        return jsText
      })
      js = allJS

      const hasLargeImages = perf.imageCount > 0 && (imageSize / perf.imageCount) > 50000

      return {
        ...perf,
        imageSize,
        scriptSize,
        cssSize: perf.cssCount * 50,
        hasLargeImages,
        html,
        css,
        js,
      }
    } catch (err) {
      logger.warn({ err: String(err), url }, 'Navigation failed during performance collection')
      try { html = await page.content() } catch { html = '' }
      return {
        loadTime: 0,
        domContentLoaded: 0,
        domSize: 0,
        totalResources: 0,
        totalResourceSize: 0,
        imageCount: 0,
        imageSize: 0,
        scriptCount: 0,
        scriptSize: 0,
        cssCount: 0,
        cssSize: 0,
        fontCount: 0,
        hasLazyLoading: false,
        hasMinifiedResources: false,
        hasLargeImages: false,
        largestContentfulPaint: null,
        cumulativeLayoutShift: null,
        firstInputDelay: null,
        html,
        css,
        js: '',
      }
    }
  }

  private async analyzeMeta(page: Page, html: string): Promise<MetaAnalysis> {
    const getMeta = (name: string): string | null => {
      const regex = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
      const match = html.match(regex)
      return match ? match[1] : null
    }

    const schemaTypes: string[] = []
    const schemaMatch = html.match(/"@type"\s*:\s*"([^"]+)"/g)
    if (schemaMatch) {
      schemaMatch.forEach(m => {
        const t = m.match(/"([^"]+)"$/)
        if (t && !schemaTypes.includes(t[1])) schemaTypes.push(t[1])
      })
    }

    const ogImage = getMeta('og:image') || getMeta('twitter:image')
    const title = await page.title() || getMeta('og:title') || ''

    return {
      title,
      titleLength: title.length,
      metaDescription: getMeta('description'),
      descriptionLength: (getMeta('description') || '').length,
      ogTitle: getMeta('og:title'),
      ogDescription: getMeta('og:description'),
      ogImage,
      ogUrl: getMeta('og:url'),
      twitterCard: getMeta('twitter:card'),
      twitterTitle: getMeta('twitter:title'),
      twitterDescription: getMeta('twitter:description'),
      twitterImage: getMeta('twitter:image'),
      canonical: (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1] || null,
      robots: getMeta('robots'),
      hasSchemaOrg: html.includes('schema.org') || html.includes('itemscope') || html.includes('itemtype'),
      hasJSONLD: html.includes('application/ld+json'),
      schemaTypes,
      hreflang: [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["']/gi)].map(m => m[1]),
      charset: (html.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i) || [])[1] || null,
      viewport: getMeta('viewport'),
      themeColor: getMeta('theme-color') || (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i) || [])[1] || null,
      favicon: /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html),
      appleTouchIcon: /<link[^>]+rel=["']apple-touch-icon["']/i.test(html),
    }
  }

  private async analyzeSecurity(page: Page, url: string): Promise<SecurityDetails> {
    const parsedUrl = new URL(url)
    const sslValid = parsedUrl.protocol === 'https:'

    let hsts = false
    let xFrameOptions = false
    let xContentTypeOptions = false
    let contentTypeSecurity = false

    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
      if (resp) {
        const headers = resp.headers()
        hsts = !!headers['strict-transport-security']
        xFrameOptions = !!headers['x-frame-options']
        xContentTypeOptions = !!headers['x-content-type-options']
        contentTypeSecurity = !!headers['content-security-policy']
      }
    } catch { }

    const html = await page.content().catch(() => '')

    return {
      sslValid,
      sslIssuer: sslValid ? 'Valid SSL' : null,
      httpsRedirect: sslValid,
      hsts,
      xFrameOptions,
      xContentTypeOptions,
      contentTypeSecurity,
      hasCookieBanner: /cookie|gdpr|consent/i.test(html.substring(0, 3000)),
      formActionSecure: !html.includes('action="http://'),
      mixedContent: /http:\/\/[^"']+(?:\.jpg|\.png|\.css|\.js)/i.test(html),
    }
  }

  private analyzeSEO(html: string, _page: Page): SEOAnalysis {
    const h1s = html.match(/<h1[\s>]/gi) || []
    const h2s = html.match(/<h2[\s>]/gi) || []
    const h3s = html.match(/<h3[\s>]/gi) || []
    const h1Count = h1s.length
    const h2Count = h2s.length
    const h3Count = h3s.length

    const rawH1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    const hasEmptyH1 = rawH1s.some(m => !m[1].trim())
    const h2AfterH3 = html.search(/<h3[\s>]/i) < html.search(/<h2[\s>]/i)

    const internalLinks = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
      .map(m => m[1])
      .filter(h => h.startsWith('/') || h.startsWith('#') || !h.startsWith('http'))

    const externalLinks = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi)]
      .map(m => m[1])

    const brokenCount = internalLinks.filter(h => !h.startsWith('#')).length

    const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    const alts = images.map(m => {
      const altMatch = m[0].match(/alt=["']([^"']*)["']/i)
      return altMatch ? altMatch[1] : null
    })

    const totalImages = images.length
    const withAlt = alts.filter(a => a !== null && a !== undefined).length
    const withoutAlt = alts.filter(a => a === null).length
    const emptyAlt = alts.filter(a => a === '').length

    const bodyText = (html.match(/<body[\s>][\s\S]*<\/body>/i) || [''])[0]
    const wordCount = (bodyText.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length

    const titles = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map(m => m[1].trim()).filter(Boolean)

    return {
      hasSitemap: /sitemap/i.test(html),
      hasRobotsTxt: /robots/i.test(html),
      headingStructure: {
        h1Count,
        h2Count,
        h3Count,
        hasSingleH1: h1Count === 1,
        hierarchical: !h2AfterH3,
        hasEmptyHeadings: hasEmptyH1,
      },
      internalLinks: {
        total: internalLinks.length,
        working: internalLinks.length - brokenCount,
        broken: brokenCount,
        nofollowCount: internalLinks.filter(h => h.startsWith('#')).length,
      },
      externalLinks: {
        total: externalLinks.length,
        working: externalLinks.length,
        broken: 0,
        nofollowCount: 0,
      },
      imageAltTags: {
        totalImages,
        withAlt,
        withoutAlt,
        emptyAlt,
      },
      structuredData: {
        hasSchemaOrg: html.includes('schema.org') || html.includes('itemscope'),
        hasJSONLD: html.includes('application/ld+json'),
        hasMicrodata: html.includes('itemprop=') || html.includes('itemscope'),
        hasOpenGraph: html.includes('og:title') || html.includes('og:image'),
        hasTwitterCards: html.includes('twitter:card'),
        types: [],
      },
      contentQuality: {
        wordCount,
        hasThinContent: wordCount < 300,
        hasDuplicateContent: false,
        hasReadableFont: /font-family:\s*[^;]*(?:inter|roboto|open sans|lato|poppins|nunito|work sans|system-ui)/i.test(html),
        readingLevel: wordCount < 200 ? 'very low' : wordCount < 500 ? 'low' : 'medium',
      },
      hasBrokenLinks: brokenCount > 0,
      brokenLinksCount: brokenCount,
      hasDuplicateTitles: titles.length > 1 && new Set(titles).size < titles.length,
    }
  }

  private analyzeUI(html: string, _page: Page): UIAnalysis {
    return {
      modernDesign: /grid|flex|gap-|rounded-|shadow-|transition/i.test(html.substring(0, 5000)),
      hasAnimations: /@keyframes|animation:|transition:|animate|fade|slide/i.test(html.substring(0, 8000)),
      hasGoodTypography: /font-family[^;]*:?\s*(?:inter|roboto|poppins|lato|nunito|opensans|work.?sans|system-ui)/i.test(html),
      hasGoodColorContrast: true,
      hasGoodWhitespace: /padding|margin|gap|space-/i.test(html.substring(0, 5000)),
      hasStickyHeader: /position:\s*sticky|position:\s*fixed|sticky/i.test(html.substring(0, 3000)),
      hasFooter: /<footer[\s>]/i.test(html),
      hasNavigation: /<nav[\s>]/i.test(html) || /role=["']navigation["']/i.test(html),
      hasCTAs: /cta|btn[-\s]|button[-\s]|call.?to.?action|get.?started|contact.?us|book.?now/i.test(html),
      ctaCount: (html.match(/class=["'][^"']*(?:btn|button|cta)[^"']*["']/gi) || []).length,
      hasForms: /<form[\s>]/i.test(html),
      formCount: (html.match(/<form[\s>]/gi) || []).length,
      hasSearch: /search|find|lookup/i.test(html),
      hasBreadcrumbs: /breadcrumb|bread.?crumb/i.test(html),
      hasTestimonials: /testimonial|review|rating|star/i.test(html.substring(0, 5000)),
      hasSocialProof: /clients?|customers?|users?|trusted|partners?/i.test(html.substring(0, 5000)),
      hasBlog: /blog|article|news|post/i.test(html),
      hasPortfolio: /portfolio|work|projects?|case.?stud/i.test(html),
      hasGallery: /gallery|slider|carousel/i.test(html),
      hasFAQs: /faq|question|accordion/i.test(html),
      hasLiveChat: /tawk|livechat|intercom|crisp|chat|tidio|drift/i.test(html.substring(0, 5000)),
      hasBackToTop: /back.?to.?top|scroll.?top/i.test(html),
      hasCookieConsent: /cookie|gdpr|consent/i.test(html.substring(0, 3000)),
      touchTargetsValid: true,
      mobileFriendly: /<meta[^>]+name=["']viewport["']/i.test(html),
      responsiveLayout: /@media|grid|flex|responsive|container/i.test(html.substring(0, 3000)),
      viewportConfigured: /<meta[^>]+name=["']viewport["']/i.test(html),
    }
  }

  private analyzeContent(html: string): ContentAnalysis {
    const body = (html.match(/<body[\s>][\s\S]*<\/body>/i) || [''])[0]

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const emails: string[] = body.match(emailRegex) || []

    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g
    const phones: string[] = body.match(phoneRegex) || []

    const socialLinks: SocialLinkInfo[] = []
    const anchors: string[] = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi) || []
    anchors.forEach(a => {
      const hrefMatch = a.match(/href=["']([^"']+)["']/i)
      const href = hrefMatch ? hrefMatch[1] : ''
      for (const [platform, regex] of Object.entries(SOCIAL_PLATFORMS)) {
        if (regex.test(href) && !socialLinks.find(s => s.platform === platform)) {
          socialLinks.push({ platform, url: href, found: true })
        }
      }
    })

    const ctaPatterns = ['btn', 'button', 'cta', 'get-started', 'contact-us', 'book-now', 'learn-more', 'sign-up', 'subscribe', 'download']
    const ctaButtons = ctaPatterns.filter(p => new RegExp(p, 'i').test(html)).map(p => p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))

    const navItems = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .filter(m => m[1] && !m[1].startsWith('#') && m[2].trim().length > 1 && m[2].trim().length < 50)
      .slice(0, 20)
      .map(m => m[2].trim())

    const footerContent: string[] = []
    const footerMatch = html.match(/<footer[\s>][\s\S]*?<\/footer>/i)
    if (footerMatch) {
      footerContent.push(...(footerMatch[0].match(/<a[^>]+>([\s\S]*?)<\/a>/gi) || []).map(a => {
        const t = a.match(/>([\s\S]*?)<\/a>/)
        return t ? t[1].trim() : ''
      }).filter(Boolean))
    }

    const copyrightYear = (() => {
      const match = html.match(/copyright\s*(?:&copy;|©)?\s*(\d{4})/i)
      return match ? parseInt(match[1]) : null
    })()

    return {
      hasBusinessEmail: emails.some(e => !e.includes('example') && !e.includes('test')),
      hasPhoneNumber: phones.length > 0,
      hasAddress: /\d+\s+[A-Za-z\s,]+(?:street|road|avenue|lane|nagar|colony|society|sector|phase|building|tower)/i.test(body),
      hasContactPage: /contact|reach.?us|get.?in.?touch/i.test(html.substring(0, 5000)),
      hasAboutPage: /about.?us|about.?company|who.?we.?are|our.?story/i.test(html.substring(0, 3000)),
      hasPrivacyPolicy: /privacy|data.?protection/i.test(body),
      hasTermsPage: /terms|conditions/i.test(body),
      hasGoogleMaps: /google\.com\/maps|maps\.google|embed\.google/i.test(html),
      hasWhatsApp: /wa\.me|whatsapp\.com|whatsapp/i.test(html),
      socialLinks,
      ctaButtons,
      navigationItems: navItems,
      footerContent,
      hasCopyright: /copyright|©|&copy;/i.test(html),
      copyrightYear,
    }
  }

  private analyzeCategory(html: string, category: string): CategorySpecificAnalysis {
    const categoryKey = Object.keys(CATEGORY_FEATURES).find(
      k => category.toLowerCase().includes(k)
    )
    if (!categoryKey) return null as unknown as CategorySpecificAnalysis

    const features = CATEGORY_FEATURES[categoryKey]
    const presentFeatures = features.present.filter(f => new RegExp(f.replace(/\s+/g, '[_\\s-]'), 'i').test(html))
    const missingFeatures = features.present.filter(f => !presentFeatures.includes(f))

    return {
      category: categoryKey,
      presentFeatures,
      missingFeatures,
      score: Math.round((presentFeatures.length / features.present.length) * 100),
    }
  }

  private detectIssues(
    meta: MetaAnalysis,
    perf: PerformanceMetrics,
    security: SecurityDetails,
    seo: SEOAnalysis,
    ui: UIAnalysis,
    content: ContentAnalysis,
    categorySpecific: CategorySpecificAnalysis | null
  ): IntelligenceIssue[] {
    const issues: IntelligenceIssue[] = []

    if (!meta.title) {
      issues.push({
        type: 'missing_title',
        severity: 'critical',
        category: 'seo',
        description: 'Missing Page Title',
        detail: 'The page has no title tag. Title tags are critical for SEO and user experience.',
        recommendation: 'Add a descriptive, keyword-rich title tag between 50-60 characters.',
      })
    } else if (meta.titleLength < 30) {
      issues.push({
        type: 'short_title',
        severity: 'medium',
        category: 'seo',
        description: 'Title Tag Too Short',
        detail: `Title is only ${meta.titleLength} characters. Optimal is 50-60 characters.`,
        element: meta.title,
        recommendation: 'Extend the title to 50-60 characters for better SEO performance.',
      })
    } else if (meta.titleLength > 60) {
      issues.push({
        type: 'long_title',
        severity: 'low',
        category: 'seo',
        description: 'Title Tag Too Long',
        detail: `Title is ${meta.titleLength} characters. May be truncated in search results.`,
        element: meta.title,
        recommendation: 'Shorten the title to under 60 characters to avoid truncation.',
      })
    }

    if (!meta.metaDescription) {
      issues.push({
        type: 'missing_description',
        severity: 'high',
        category: 'seo',
        description: 'Missing Meta Description',
        detail: 'The page has no meta description tag, which helps search rankings and click-through rates.',
        recommendation: 'Add a compelling meta description between 120-158 characters.',
      })
    } else if (meta.descriptionLength < 50) {
      issues.push({
        type: 'short_description',
        severity: 'medium',
        category: 'seo',
        description: 'Meta Description Too Short',
        detail: `Description is only ${meta.descriptionLength} characters.`,
        recommendation: 'Expand the meta description to 120-158 characters for better CTR.',
      })
    }

    if (!meta.ogTitle) {
      issues.push({
        type: 'missing_og_title',
        severity: 'medium',
        category: 'seo',
        description: 'Missing Open Graph Title',
        detail: 'og:title is not set. Social media previews will not display optimally.',
        recommendation: 'Add og:title meta tag for better social media sharing.',
      })
    }

    if (!meta.ogImage) {
      issues.push({
        type: 'missing_og_image',
        severity: 'medium',
        category: 'seo',
        description: 'Missing Open Graph Image',
        detail: 'No og:image meta tag found. Shared links will lack a preview image on social media.',
        recommendation: 'Add og:image meta tag with a high-quality image (1200x630px recommended).',
      })
    }

    if (!meta.twitterCard) {
      issues.push({
        type: 'missing_twitter_card',
        severity: 'low',
        category: 'seo',
        description: 'Missing Twitter Card',
        detail: 'Twitter Card meta tag is not configured.',
        recommendation: 'Add twitter:card meta tag for rich Twitter previews.',
      })
    }

    if (!meta.canonical) {
      issues.push({
        type: 'missing_canonical',
        severity: 'medium',
        category: 'seo',
        description: 'Missing Canonical URL',
        detail: 'No canonical URL specified. May cause duplicate content issues.',
        recommendation: 'Add a canonical link tag pointing to the preferred URL.',
      })
    }

    if (!meta.hasSchemaOrg && !meta.hasJSONLD) {
      issues.push({
        type: 'missing_structured_data',
        severity: 'medium',
        category: 'seo',
        description: 'No Structured Data Found',
        detail: 'The website does not use Schema.org or JSON-LD structured data.',
        recommendation: 'Implement structured data (JSON-LD recommended) for rich search results.',
      })
    }

    if (!meta.favicon) {
      issues.push({
        type: 'missing_favicon',
        severity: 'low',
        category: 'ui',
        description: 'Missing Favicon',
        detail: 'No favicon detected. Browsers will show a default icon for the site.',
        recommendation: 'Add a favicon link tag with a proper favicon image.',
      })
    }
    if (!security.sslValid) {
      issues.push({
        type: 'no_ssl',
        severity: 'critical',
        category: 'security',
        description: 'SSL/HTTPS Not Enabled',
        detail: 'Website is served over HTTP instead of HTTPS. This is a security and SEO risk.',
        recommendation: 'Install an SSL certificate and redirect HTTP to HTTPS.',
      })
    }
    if (security.mixedContent) {
      issues.push({
        type: 'mixed_content',
        severity: 'high',
        category: 'security',
        description: 'Mixed Content Detected',
        detail: 'Page loads resources over HTTP while served over HTTPS.',
        recommendation: 'Ensure all resources are loaded over HTTPS.',
      })
    }
    if (!security.hsts) {
      issues.push({
        type: 'missing_hsts',
        severity: 'low',
        category: 'security',
        description: 'HSTS Not Enabled',
        detail: 'Strict-Transport-Security header is missing.',
        recommendation: 'Enable HSTS header to enforce HTTPS connections.',
      })
    }

    if (perf.loadTime > 5000 && perf.loadTime > 0) {
      issues.push({
        type: 'slow_load',
        severity: 'high',
        category: 'performance',
        description: `Slow Page Load (${(perf.loadTime / 1000).toFixed(1)}s)`,
        detail: `Page loaded in ${(perf.loadTime / 1000).toFixed(1)} seconds, exceeding the recommended 3 seconds.`,
        recommendation: 'Optimize images, enable compression, reduce server response time, and implement caching.',
      })
    } else if (perf.loadTime > 3000 && perf.loadTime > 0) {
      issues.push({
        type: 'moderate_load',
        severity: 'medium',
        category: 'performance',
        description: `Moderate Page Load (${(perf.loadTime / 1000).toFixed(1)}s)`,
        detail: `Page loaded in ${(perf.loadTime / 1000).toFixed(1)} seconds. Aim for under 3 seconds.`,
        recommendation: 'Consider optimizing images, minifying CSS/JS, and using CDN.',
      })
    }

    if (perf.hasLargeImages) {
      issues.push({
        type: 'large_images',
        severity: 'medium',
        category: 'performance',
        description: 'Unoptimized Images Detected',
        detail: 'Images appear to be large in size, which slows down page load.',
        recommendation: 'Compress images using modern formats (WebP, AVIF) and implement lazy loading.',
      })
    }

    if (!perf.hasLazyLoading) {
      issues.push({
        type: 'no_lazy_loading',
        severity: 'low',
        category: 'performance',
        description: 'Lazy Loading Not Implemented',
        detail: 'Images and iframes do not use lazy loading.',
        recommendation: 'Add loading="lazy" to images and iframes below the fold.',
      })
    }

    if (seo.headingStructure.h1Count === 0) {
      issues.push({
        type: 'missing_h1',
        severity: 'high',
        category: 'seo',
        description: 'Missing H1 Heading',
        detail: 'No H1 tag found on the page. H1 is critical for SEO and accessibility.',
        recommendation: 'Add a single, descriptive H1 tag that includes primary keywords.',
      })
    }
    if (seo.headingStructure.h1Count > 1) {
      issues.push({
        type: 'multiple_h1',
        severity: 'medium',
        category: 'seo',
        description: `Multiple H1 Headings (${seo.headingStructure.h1Count})`,
        detail: `Found ${seo.headingStructure.h1Count} H1 tags. Best practice is one H1 per page.`,
        recommendation: 'Use only one H1 tag per page for clear content hierarchy.',
      })
    }
    if (!seo.headingStructure.hierarchical) {
      issues.push({
        type: 'broken_heading_hierarchy',
        severity: 'medium',
        category: 'seo',
        description: 'Broken Heading Hierarchy',
        detail: 'H3 tags appear before H2 tags, breaking the heading structure.',
        recommendation: 'Maintain a logical hierarchy: H1 → H2 → H3 → H4.',
      })
    }
    if (seo.headingStructure.hasEmptyHeadings) {
      issues.push({
        type: 'empty_headings',
        severity: 'low',
        category: 'seo',
        description: 'Empty Headings Detected',
        detail: 'Some heading tags contain no visible text content.',
        recommendation: 'Remove empty headings or add meaningful content to them.',
      })
    }

    if (seo.imageAltTags.totalImages > 0 && seo.imageAltTags.withoutAlt > 0) {
      issues.push({
        type: 'missing_alt_tags',
        severity: 'medium',
        category: 'accessibility',
        description: `Images Missing Alt Text (${seo.imageAltTags.withoutAlt})`,
        detail: `${seo.imageAltTags.withoutAlt} out of ${seo.imageAltTags.totalImages} images are missing alt attributes.`,
        recommendation: 'Add descriptive alt text to all images for accessibility and SEO.',
      })
    }
    if (seo.imageAltTags.emptyAlt > 0) {
      issues.push({
        type: 'empty_alt_tags',
        severity: 'low',
        category: 'accessibility',
        description: `Empty Alt Attributes (${seo.imageAltTags.emptyAlt})`,
        detail: `${seo.imageAltTags.emptyAlt} images have empty alt attributes.`,
        recommendation: 'Use empty alt only for decorative images; add descriptive alt for informative images.',
      })
    }

    if (seo.contentQuality.hasThinContent) {
      issues.push({
        type: 'thin_content',
        severity: 'medium',
        category: 'seo',
        description: 'Thin Content Detected',
        detail: `Page has only ${seo.contentQuality.wordCount} words. Thin content ranks poorly in search.`,
        recommendation: 'Add more substantive content — aim for at least 500 words per page.',
      })
    }

    if (seo.hasBrokenLinks) {
      issues.push({
        type: 'broken_links',
        severity: 'medium',
        category: 'seo',
        description: `Broken Internal Links (${seo.brokenLinksCount})`,
        detail: `${seo.brokenLinksCount} internal links may be broken or pointing to empty locations.`,
        recommendation: 'Fix or remove broken internal links to improve user experience and SEO.',
      })
    }

    if (seo.hasDuplicateTitles) {
      issues.push({
        type: 'duplicate_titles',
        severity: 'high',
        category: 'seo',
        description: 'Duplicate Page Titles',
        detail: 'Multiple pages appear to have the same title tag.',
        recommendation: 'Ensure every page has a unique, descriptive title tag.',
      })
    }

    if (!ui.hasFooter) {
      issues.push({
        type: 'missing_footer',
        severity: 'medium',
        category: 'ui',
        description: 'Missing Footer Section',
        detail: 'No footer tag detected. Footers provide navigation and credibility.',
        recommendation: 'Add a footer with contact info, links, and copyright notice.',
      })
    }
    if (!ui.hasNavigation) {
      issues.push({
        type: 'missing_navigation',
        severity: 'high',
        category: 'ui',
        description: 'Missing Navigation',
        detail: 'No navigation element found. Users need clear navigation paths.',
        recommendation: 'Add a navigation menu with clear, descriptive labels.',
      })
    }
    if (!ui.hasCTAs) {
      issues.push({
        type: 'missing_cta',
        severity: 'high',
        category: 'ui',
        description: 'No Call-to-Action Found',
        detail: 'Page lacks clear call-to-action buttons, reducing conversion opportunities.',
        recommendation: 'Add prominent CTAs like "Contact Us", "Get a Quote", or "Book Now".',
      })
    }
    if (!ui.viewportConfigured) {
      issues.push({
        type: 'no_viewport_meta',
        severity: 'high',
        category: 'responsive',
        description: 'Missing Viewport Meta Tag',
        detail: 'Viewport meta tag not found. Page will not render properly on mobile devices.',
        recommendation: 'Add viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1">',
      })
    }
    if (!ui.mobileFriendly) {
      issues.push({
        type: 'not_mobile_friendly',
        severity: 'high',
        category: 'responsive',
        description: 'Page Not Mobile Friendly',
        detail: 'The page does not appear optimized for mobile devices.',
        recommendation: 'Implement responsive design using CSS media queries and flexible layouts.',
      })
    }

    if (!content.hasBusinessEmail && !content.hasPhoneNumber) {
      issues.push({
        type: 'no_contact_info',
        severity: 'high',
        category: 'trust',
        description: 'No Contact Information Found',
        detail: 'No email or phone number detected. This reduces business credibility.',
        recommendation: 'Add visible contact information including phone and email.',
      })
    }
    if (!content.hasContactPage) {
      issues.push({
        type: 'no_contact_page',
        severity: 'medium',
        category: 'trust',
        description: 'No Dedicated Contact Page',
        detail: 'No contact page detected. Makes it harder for potential customers to reach out.',
        recommendation: 'Add a dedicated contact page with form, phone, email, and address.',
      })
    }
    if (!content.hasAboutPage) {
      issues.push({
        type: 'no_about_page',
        severity: 'medium',
        category: 'trust',
        description: 'No About Page Detected',
        detail: 'No about page found. About pages build trust and tell the business story.',
        recommendation: 'Add an about page with company information, team, and mission.',
      })
    }
    if (!content.hasPrivacyPolicy) {
      issues.push({
        type: 'no_privacy_policy',
        severity: 'medium',
        category: 'trust',
        description: 'No Privacy Policy Found',
        detail: 'Privacy policy is missing. May be required by law and builds user trust.',
        recommendation: 'Add a privacy policy page detailing data collection and usage.',
      })
    }
    if (!content.hasGoogleMaps) {
      issues.push({
        type: 'no_google_maps',
        severity: 'low',
        category: 'trust',
        description: 'Google Maps Not Embedded',
        detail: 'No Google Maps embed found. Maps help customers find the business location.',
        recommendation: 'Embed a Google Map showing the business location on the contact page.',
      })
    }

    if (!ui.hasForms) {
      issues.push({
        type: 'no_forms',
        severity: 'medium',
        category: 'ui',
        description: 'No Forms Detected',
        detail: 'No form elements found. Forms enable lead capture and customer inquiries.',
        recommendation: 'Add a contact form or inquiry form to capture leads.',
      })
    }

    if (!ui.hasLiveChat) {
      issues.push({
        type: 'no_live_chat',
        severity: 'low',
        category: 'ui',
        description: 'No Live Chat Widget',
        detail: 'No live chat or chatbot detected on the website.',
        recommendation: 'Consider adding a live chat widget to engage visitors in real-time.',
      })
    }

    if (!ui.hasBlog) {
      issues.push({
        type: 'no_blog',
        severity: 'low',
        category: 'content',
        description: 'No Blog Section Found',
        detail: 'A blog helps with SEO, authority building, and content marketing.',
        recommendation: 'Start a blog to publish industry-relevant content and improve SEO.',
      })
    }

    if (!meta.appleTouchIcon) {
      issues.push({
        type: 'missing_apple_touch_icon',
        severity: 'info',
        category: 'ui',
        description: 'Missing Apple Touch Icon',
        detail: 'No apple-touch-icon detected for iOS devices.',
        recommendation: 'Add apple-touch-icon for better appearance when bookmarked on iOS.',
      })
    }

    if (categorySpecific) {
      categorySpecific.missingFeatures.forEach(f => {
        issues.push({
          type: `missing_${f.replace(/\s+/g, '_')}`,
          severity: 'medium',
          category: 'category_specific',
          description: `Missing ${f.charAt(0).toUpperCase() + f.slice(1)} Section`,
          detail: `The website does not have a visible ${f} section, which is expected for ${categorySpecific.category} websites.`,
          recommendation: `Add a ${f.toLowerCase()} section to meet customer expectations.`,
        })
      })
    }

    return issues
  }

  private generateRecommendations(issues: IntelligenceIssue[], content: ContentAnalysis): IntelligenceRecommendation[] {
    const recs: IntelligenceRecommendation[] = []
    const criticalIssues = issues.filter(i => i.severity === 'critical')
    const highIssues = issues.filter(i => i.severity === 'high')
    const mediumIssues = issues.filter(i => i.severity === 'medium')
    const byCategory = (cat: string) => issues.filter(i => i.category === cat)

    if (criticalIssues.length > 0) {
      criticalIssues.forEach(issue => {
        recs.push({
          title: issue.description,
          description: issue.recommendation,
          impact: 'high',
          effort: issue.type === 'no_ssl' ? 'medium' : 'low',
          category: issue.category,
        })
      })
    }

    if (highIssues.length > 0) {
      highIssues.slice(0, 5).forEach(issue => {
        recs.push({
          title: `Fix: ${issue.description}`,
          description: issue.recommendation,
          impact: 'high',
          effort: 'medium',
          category: issue.category,
        })
      })
    }

    const seoIssues = byCategory('seo')
    if (seoIssues.length > 0) {
      const missingStructuredData = issues.find(i => i.type === 'missing_structured_data')
      if (missingStructuredData) {
        recs.push({
          title: 'Implement Structured Data',
          description: 'Add JSON-LD structured data markup to help search engines understand your content. Include LocalBusiness schema with name, address, phone, and operating hours.',
          impact: 'high',
          effort: 'medium',
          category: 'seo',
        })
      }
    }

    if (!content.hasPrivacyPolicy) {
      recs.push({
        title: 'Add Privacy Policy & Legal Pages',
        description: 'Create privacy policy, terms of service, and other legal pages. These build trust and are legally required in many jurisdictions.',
        impact: 'medium',
        effort: 'low',
        category: 'trust',
      })
    }

    const perfIssues = byCategory('performance')
    if (perfIssues.length > 0) {
      recs.push({
        title: 'Optimize Website Performance',
        description: 'Implement image compression, minify CSS/JS, enable browser caching, use CDN, and reduce server response time for better Core Web Vitals.',
        impact: 'high',
        effort: 'medium',
        category: 'performance',
      })
    }

    const responsiveIssues = byCategory('responsive')
    if (responsiveIssues.length > 0) {
      recs.push({
        title: 'Improve Mobile Responsiveness',
        description: 'Use responsive design with fluid grids, flexible images, and CSS media queries to ensure the site works perfectly on all devices.',
        impact: 'high',
        effort: 'medium',
        category: 'responsive',
      })
    }

    const trustIssues = byCategory('trust')
    if (trustIssues.length > 0) {
      recs.push({
        title: 'Build Trust Signals',
        description: 'Add contact information, about page, testimonials, case studies, and trust badges to increase visitor confidence.',
        impact: 'medium',
        effort: 'low',
        category: 'trust',
      })
    }

    if (mediumIssues.length > 0) {
      const remainingMedium = mediumIssues.filter(i =>
        !recs.some(r => r.description.includes(i.recommendation.substring(0, 30)))
      ).slice(0, 3)

      remainingMedium.forEach(issue => {
        recs.push({
          title: `Improve: ${issue.description}`,
          description: issue.recommendation,
          impact: 'medium',
          effort: 'low',
          category: issue.category,
        })
      })
    }

    recs.push({
      title: 'Conduct Regular SEO Audits',
      description: 'Perform regular SEO audits to identify and fix issues early. Monitor rankings, backlinks, and organic traffic monthly.',
      impact: 'medium',
      effort: 'low',
      category: 'seo',
    })

    return recs.slice(0, 15)
  }

  private calculateScores(
    meta: MetaAnalysis,
    perf: PerformanceMetrics,
    security: SecurityDetails,
    seo: SEOAnalysis,
    ui: UIAnalysis,
    content: ContentAnalysis,
    issues: IntelligenceIssue[]
  ): {
    trustScore: number
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
  } {
    const clamp = (v: number) => Math.max(0, Math.min(100, v))

    const seoScore = clamp(
      (meta.title ? 10 : 0) +
      (meta.metaDescription ? 10 : 0) +
      (meta.ogTitle ? 5 : 0) +
      (meta.ogImage ? 5 : 0) +
      (meta.canonical ? 5 : 0) +
      (meta.hasSchemaOrg || meta.hasJSONLD ? 10 : 0) +
      (seo.headingStructure.hasSingleH1 ? 10 : 0) +
      (seo.headingStructure.h1Count > 0 ? 5 : 0) +
      (seo.contentQuality.hasThinContent ? 0 : 10) +
      (seo.hasSitemap ? 5 : 0) +
      (seo.imageAltTags.totalImages === 0 || (seo.imageAltTags.withAlt / Math.max(seo.imageAltTags.totalImages, 1)) > 0.5 ? 10 : 0) +
      (ui.hasNavigation ? 5 : 0) +
      (seo.hasBrokenLinks ? 0 : 5) +
      (seo.hasDuplicateTitles ? 0 : 5)
    )

    const trustScore = clamp(
      (security.sslValid ? 20 : 0) +
      (content.hasBusinessEmail ? 10 : 0) +
      (content.hasPhoneNumber ? 10 : 0) +
      (content.hasContactPage ? 10 : 0) +
      (content.hasAboutPage ? 10 : 0) +
      (content.hasPrivacyPolicy ? 10 : 0) +
      (content.hasGoogleMaps ? 5 : 0) +
      (content.socialLinks.length > 0 ? 5 : 0) +
      (content.hasCopyright ? 10 : 0) +
      (ui.hasFooter ? 5 : 0) +
      (ui.hasTestimonials ? 5 : 0)
    )

    const performanceScore = clamp(
      perf.loadTime === 0 ? 30 :
        perf.loadTime < 2000 ? 90 :
        perf.loadTime < 3000 ? 70 :
        perf.loadTime < 5000 ? 50 :
        perf.loadTime < 8000 ? 30 : 15 +
      (perf.hasLazyLoading ? 10 : 0) +
      (perf.hasMinifiedResources ? 10 : 0) +
      (perf.hasLargeImages ? 0 : 10)
    )

    const securityScore = clamp(
      (security.sslValid ? 30 : 0) +
      (security.httpsRedirect ? 10 : 0) +
      (security.hsts ? 15 : 0) +
      (security.xFrameOptions ? 10 : 0) +
      (security.xContentTypeOptions ? 10 : 0) +
      (security.contentTypeSecurity ? 10 : 0) +
      (security.mixedContent ? 0 : 15)
    )

    const uiScore = clamp(
      (ui.modernDesign ? 15 : 0) +
      (ui.hasGoodTypography ? 10 : 0) +
      (ui.hasGoodWhitespace ? 10 : 0) +
      (ui.hasAnimations ? 5 : 0) +
      (ui.hasFooter ? 10 : 0) +
      (ui.hasNavigation ? 10 : 0) +
      (ui.hasCTAs ? 10 : 0) +
      (ui.hasStickyHeader ? 5 : 0) +
      (ui.hasSearch ? 5 : 0) +
      (ui.hasBreadcrumbs ? 5 : 0) +
      (ui.hasBackToTop ? 5 : 0) +
      (meta.favicon ? 5 : 0) +
      (meta.appleTouchIcon ? 5 : 0)
    )

    const accessibilityScore = clamp(
      (seo.imageAltTags.totalImages === 0 || (seo.imageAltTags.withAlt / Math.max(seo.imageAltTags.totalImages, 1)) > 0.8 ? 30 : 10) +
      (seo.headingStructure.h1Count > 0 ? 20 : 0) +
      (ui.hasNavigation ? 15 : 0) +
      (seo.imageAltTags.emptyAlt === 0 ? 15 : 5) +
      (ui.viewportConfigured ? 20 : 0)
    )

    const mobileScore = clamp(
      (ui.viewportConfigured ? 25 : 0) +
      (ui.mobileFriendly ? 25 : 0) +
      (ui.responsiveLayout ? 25 : 0) +
      (ui.touchTargetsValid ? 25 : 0)
    )

    const uxScore = clamp(
      (performanceScore * 0.2) +
      (uiScore * 0.3) +
      (mobileScore * 0.2) +
      (accessibilityScore * 0.15) +
      (perf.loadTime < 3000 ? 15 : 5)
    )

    const qualityScore = clamp(
      (seoScore * 0.2) +
      (uiScore * 0.2) +
      (performanceScore * 0.15) +
      (trustScore * 0.15) +
      (mobileScore * 0.15) +
      (accessibilityScore * 0.15)
    )

    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const highCount = issues.filter(i => i.severity === 'high').length
    const mediumCount = issues.filter(i => i.severity === 'medium').length

    const opportunityMultiplier = Math.min(
      (criticalCount * 3 + highCount * 2 + mediumCount * 1) / 10,
      1
    )

    const businessOpportunityScore = clamp(
      Math.round((100 - qualityScore) * opportunityMultiplier * 1.5)
    )

    const leadPriorityScore = clamp(
      Math.round(
        (seoScore * 0.1) +
        (trustScore * 0.15) +
        (performanceScore * 0.1) +
        (securityScore * 0.1) +
        (100 - qualityScore) * 0.3 +
        (content.socialLinks.length > 0 ? 10 : 0) +
        (content.hasBusinessEmail ? 5 : 0) +
        (content.hasPhoneNumber ? 5 : 0) +
        (businessOpportunityScore * 0.1)
      )
    )

    return {
      trustScore: Math.round(trustScore),
      qualityScore: Math.round(qualityScore),
      seoScore: Math.round(seoScore),
      uiScore: Math.round(uiScore),
      uxScore: Math.round(uxScore),
      performanceScore: Math.round(performanceScore),
      accessibilityScore: Math.round(accessibilityScore),
      securityScore: Math.round(securityScore),
      mobileScore: Math.round(mobileScore),
      businessOpportunityScore: Math.round(businessOpportunityScore),
      leadPriorityScore: Math.round(leadPriorityScore),
    }
  }

  private getDefaultReport(): WebsiteIntelligenceReport {
    return {
      trustScore: 0,
      trustScoreLevel: 'low',
      qualityScore: 0,
      seoScore: 0,
      uiScore: 0,
      uxScore: 0,
      performanceScore: 0,
      accessibilityScore: 0,
      securityScore: 0,
      mobileScore: 0,
      businessOpportunityScore: 0,
      leadPriorityScore: 0,
      issues: [],
      recommendations: [],
      metaAnalysis: {
        title: null, titleLength: 0, metaDescription: null, descriptionLength: 0,
        ogTitle: null, ogDescription: null, ogImage: null, ogUrl: null,
        twitterCard: null, twitterTitle: null, twitterDescription: null, twitterImage: null,
        canonical: null, robots: null, hasSchemaOrg: false, hasJSONLD: false,
        schemaTypes: [], hreflang: [], charset: null, viewport: null,
        themeColor: null, favicon: false, appleTouchIcon: false,
      },
      performanceMetrics: {
        loadTime: 0, domContentLoaded: 0, domSize: 0, totalResources: 0, totalResourceSize: 0,
        imageCount: 0, imageSize: 0, scriptCount: 0, scriptSize: 0, cssCount: 0, cssSize: 0,
        fontCount: 0, hasLazyLoading: false, hasMinifiedResources: false, hasLargeImages: false,
        largestContentfulPaint: null, cumulativeLayoutShift: null, firstInputDelay: null,
      },
      securityDetails: {
        sslValid: false, sslIssuer: null, httpsRedirect: false, hsts: false,
        xFrameOptions: false, xContentTypeOptions: false, contentTypeSecurity: false,
        hasCookieBanner: false, formActionSecure: false, mixedContent: false,
      },
      seoDetails: {
        hasSitemap: false, hasRobotsTxt: false,
        headingStructure: { h1Count: 0, h2Count: 0, h3Count: 0, hasSingleH1: false, hierarchical: false, hasEmptyHeadings: false },
        internalLinks: { total: 0, working: 0, broken: 0, nofollowCount: 0 },
        externalLinks: { total: 0, working: 0, broken: 0, nofollowCount: 0 },
        imageAltTags: { totalImages: 0, withAlt: 0, withoutAlt: 0, emptyAlt: 0 },
        structuredData: { hasSchemaOrg: false, hasJSONLD: false, hasMicrodata: false, hasOpenGraph: false, hasTwitterCards: false, types: [] },
        contentQuality: { wordCount: 0, hasThinContent: false, hasDuplicateContent: false, hasReadableFont: false, readingLevel: 'unknown' },
        hasBrokenLinks: false, brokenLinksCount: 0, hasDuplicateTitles: false,
      },
      uiDetails: {
        modernDesign: false, hasAnimations: false, hasGoodTypography: false,
        hasGoodColorContrast: false, hasGoodWhitespace: false, hasStickyHeader: false,
        hasFooter: false, hasNavigation: false, hasCTAs: false, ctaCount: 0,
        hasForms: false, formCount: 0, hasSearch: false, hasBreadcrumbs: false,
        hasTestimonials: false, hasSocialProof: false, hasBlog: false, hasPortfolio: false,
        hasGallery: false, hasFAQs: false, hasLiveChat: false, hasBackToTop: false,
        hasCookieConsent: false, touchTargetsValid: false, mobileFriendly: false,
        responsiveLayout: false, viewportConfigured: false,
      },
      contentAnalysis: {
        hasBusinessEmail: false, hasPhoneNumber: false, hasAddress: false,
        hasContactPage: false, hasAboutPage: false, hasPrivacyPolicy: false,
        hasTermsPage: false, hasGoogleMaps: false, hasWhatsApp: false,
        socialLinks: [], ctaButtons: [], navigationItems: [], footerContent: [],
        hasCopyright: false, copyrightYear: null,
      },
      categorySpecific: null,
      websiteHash: '',
      analyzedAt: new Date(),
      analysisDuration: 0,
      intelligenceCompleted: false,
    }
  }
}

export const websiteIntelligenceEngine = new WebsiteIntelligenceEngine()
