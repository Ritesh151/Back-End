import { Lead, ILead } from '../models/Lead'
import { logger } from '../utils/logger'
import { websiteIntelligenceEngine } from '../website-intelligence'
import { websiteAnalysisService } from './website-analysis.service'
import { auditCache } from './audit-cache.service'
import { withTimeout } from '../utils/audit-timeout'
import pLimit from 'p-limit'

interface IntelligenceOptions {
  timeout?: number
  forceRefresh?: boolean
}

interface BulkResult {
  success: boolean
  message: string
  totalProcessed: number
  successful: number
  failed: number
  results: Array<{ leadId: string; success: boolean; error?: string }>
}

export class WebsiteIntelligenceService {
  private readonly maxConcurrent = 3
  private readonly limit = pLimit(this.maxConcurrent)

  async analyzeLead(leadId: string, options: IntelligenceOptions = {}): Promise<ILead | null> {
    try {
      const lead = await Lead.findById(leadId)
      if (!lead) {
        logger.warn(`Lead not found: ${leadId}`)
        return null
      }

      if (!lead.hasWebsite || !lead.website) {
        logger.warn(`Lead ${leadId} has no website`)
        return lead
      }

      const analysis = websiteAnalysisService.resolveLead(lead)

      if (!analysis.analysisEligible) {
        logger.warn(`[WebsiteIntelligenceService] Lead ${leadId} is not analysis-eligible (websiteType=${lead.websiteType}) — skipping intelligence`)
        logger.info('[WebsiteIntelligence] AI Started — Skipped (analysisEligible is false)')
        return lead
      }

      logger.info('[WebsiteIntelligence] AI Started')

      if (lead.intelligenceCompleted && !options.forceRefresh && lead.hasWebsite && lead.website) {
        const cacheKey = `website-intel:${leadId}`
        const cached = auditCache.getByWebsiteHash<ILead>(cacheKey, lead.website)
        if (cached.isCached) {
          logger.info(`Returning cached website intelligence for lead ${leadId}`)
          return cached.data
        }
      }

      logger.info(`Starting website intelligence analysis for lead ${leadId}: ${lead.website}`)

      const report = await withTimeout(
        websiteIntelligenceEngine.analyzeWebsite(lead.website, {
          timeout: options.timeout,
          category: lead.category,
        }),
        90000,
        `WebsiteIntelligence.analyzeWebsite(${leadId})`
      )

      lead.intelligenceCompleted = report.intelligenceCompleted
      lead.intelligenceAnalyzedAt = report.analyzedAt
      lead.intelligenceAnalysisDuration = report.analysisDuration
      lead.intelligenceWebsiteHash = report.websiteHash

      lead.websiteIntelligence = {
        trustScore: report.trustScore,
        trustScoreLevel: report.trustScoreLevel,
        qualityScore: report.qualityScore,
        seoScore: report.seoScore,
        uiScore: report.uiScore,
        uxScore: report.uxScore,
        performanceScore: report.performanceScore,
        accessibilityScore: report.accessibilityScore,
        securityScore: report.securityScore,
        mobileScore: report.mobileScore,
        businessOpportunityScore: report.businessOpportunityScore,
        leadPriorityScore: report.leadPriorityScore,
        issues: report.issues,
        recommendations: report.recommendations,
        metaAnalysis: report.metaAnalysis as unknown as Record<string, unknown>,
        performanceMetrics: report.performanceMetrics as unknown as Record<string, unknown>,
        securityDetails: report.securityDetails as unknown as Record<string, unknown>,
        seoDetails: report.seoDetails as unknown as Record<string, unknown>,
        uiDetails: report.uiDetails as unknown as Record<string, unknown>,
        contentAnalysis: report.contentAnalysis as unknown as Record<string, unknown>,
        categorySpecific: report.categorySpecific as unknown as Record<string, unknown> | null,
        analysisDuration: report.analysisDuration,
        analyzedAt: report.analyzedAt,
      }

      await lead.save()

      if (lead.hasWebsite && lead.website) {
        auditCache.set(`website-intel:${leadId}`, lead, lead.website)
      }

      logger.info(`Website intelligence completed for lead ${leadId}: trust=${report.trustScore}, seo=${report.seoScore}, issues=${report.issues.length}`)
      return lead
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Failed website intelligence for lead ${leadId}:`)
      try {
        const lead = await Lead.findById(leadId)
        if (lead) lead.intelligenceCompleted = false
        await lead?.save()
      } catch { }
      return null
    }
  }

  async analyzeMultipleLeads(leadIds: string[], options: IntelligenceOptions = {}): Promise<BulkResult> {
    logger.info(`Starting bulk website intelligence for ${leadIds.length} leads`)

    const results = await Promise.all(
      leadIds.map(leadId =>
        this.limit(async () => {
          try {
            const lead = await this.analyzeLead(leadId, options)
            return { leadId, success: !!lead }
          } catch (error) {
            logger.error(error instanceof Error ? error : new Error(String(error)), `Bulk intelligence failed for ${leadId}:`)
            return { leadId, success: false, error: error instanceof Error ? error.message : String(error) }
          }
        })
      )
    )

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return {
      success: true,
      message: `Analyzed ${leadIds.length} leads: ${successful} successful, ${failed} failed`,
      totalProcessed: leadIds.length,
      successful,
      failed,
      results,
    }
  }

  async reanalyzeLead(leadId: string, options: IntelligenceOptions = {}): Promise<ILead | null> {
    logger.info(`Re-analyzing website intelligence for lead ${leadId}`)
    return this.analyzeLead(leadId, { ...options, forceRefresh: true })
  }

  async getIntelligenceStats(): Promise<{
    total: number
    analyzed: number
    notAnalyzed: number
    averageTrustScore: number
    averageQualityScore: number
    highOpportunity: number
  }> {
    try {
      const total = await Lead.countDocuments({ website: { $exists: true, $nin: [null, ''] } })
      const analyzed = await Lead.countDocuments({ intelligenceCompleted: true })
      const notAnalyzed = total - analyzed

      const agg = await Lead.aggregate([
        { $match: { intelligenceCompleted: true } },
        { $group: { _id: null, avgTrust: { $avg: '$websiteIntelligence.trustScore' }, avgQuality: { $avg: '$websiteIntelligence.qualityScore' } } },
      ])

      const highOpportunity = await Lead.countDocuments({ 'websiteIntelligence.businessOpportunityScore': { $gte: 70 } })

      return {
        total,
        analyzed,
        notAnalyzed,
        averageTrustScore: Math.round(agg[0]?.avgTrust || 0),
        averageQualityScore: Math.round(agg[0]?.avgQuality || 0),
        highOpportunity,
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to get intelligence stats:')
      return { total: 0, analyzed: 0, notAnalyzed: 0, averageTrustScore: 0, averageQualityScore: 0, highOpportunity: 0 }
    }
  }
}

export const websiteIntelligenceService = new WebsiteIntelligenceService()
