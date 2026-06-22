import { logger } from '../utils/logger';
import { ILead, Lead } from '../models/Lead';
import { SourceConfig } from './source-config';
import type { ExtractionSource } from '../constants';
import { websiteAnalysisService } from '../services/website-analysis.service';
import { classifyWebsiteUrl } from '../modules/leads/services/urlClassifier.service';

const MARKETPLACE_PLATFORM_MAP: Record<string, string> = {
  justdial: 'justdial',
  indiamart: 'indiamart',
  sulekha: 'sulekha',
  tradeindia: 'tradeindia',
  yellowpages: 'yellowpages',
  amazon: 'amazon',
  flipkart: 'flipkart',
  meesho: 'meesho',
};

function classifyLeadWebsite(leadDoc: Record<string, unknown>, website: string | undefined): void {
  if (!website) return;

  const analysis = websiteAnalysisService.getLeadFields(website);

  leadDoc.website = analysis.website;
  leadDoc.hasWebsite = analysis.hasWebsite;
  leadDoc.normalizedDomain = analysis.normalizedDomain;
  leadDoc.analysisEligible = analysis.analysisEligible;
  leadDoc.hasRealWebsite = analysis.analysisEligible;
  leadDoc.websiteType = analysis.websiteType;
  leadDoc.websiteAuditAllowed = analysis.analysisEligible;

  if (!analysis.analysisEligible) {
    const classification = classifyWebsiteUrl(website);

    if (classification.normalizedUrl && classification.websiteType !== 'INVALID_URL') {
      const existingSocial = (leadDoc.socialLinks || {}) as Record<string, unknown>;
      const platform = classification.socialProfiles;
      for (const [key, value] of Object.entries(platform)) {
        if (key === 'other' && Array.isArray(value)) {
          const existing = (existingSocial.other as string[]) || [];
          existingSocial.other = [...existing, ...value];
        } else if (typeof value === 'string' && value) {
          existingSocial[key] = value;
        }
      }

      if (classification.websiteType === 'MARKETPLACE_PROFILE' && classification.normalizedUrl) {
        const existingMarketplace = (leadDoc.marketplaceLinks || {}) as Record<string, unknown>;
        const hostname = classification.normalizedUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
        for (const [domain, platform] of Object.entries(MARKETPLACE_PLATFORM_MAP)) {
          if (hostname.includes(domain)) {
            existingMarketplace[platform] = classification.normalizedUrl;
            break;
          }
        }
      }
    }
  }
}

export interface LeadData {
  id: string;
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  source: string;
  sourceUrl?: string;
  leadScore?: number;
  href?: string;
  placeId?: string;
  createdAt: string;
  area?: string;
  city?: string;
  state?: string;
  businessType?: string;
  fullSearchQuery?: string;
  locationRelevanceScore?: number;
  relevanceScore?: number;
  validatedCategory?: string;
  sources?: string[];
  locationConfidence?: number;
  categoryConfidence?: number;
  finalConfidence?: number;
  validationStatus?: 'validated' | 'rejected' | 'needs-review';
  rejectionReason?: string;
  aiMatchType?: string;
  aiWarnings?: string[];
  aiQuality?: 'excellent' | 'good' | 'average' | 'poor';
  semanticCategory?: string;
  semanticCategoryName?: string;
  matchedKeyword?: string;
  originalSearchedKeyword?: string;
  searchGroup?: string;
  semanticMatchReason?: string;
  expandedFromKeyword?: string;
}

export interface ScrapingResult {
  success: boolean;
  message: string;
  totalExtracted: number;
  totalStored: number;
  totalDuplicates: number;
  leads: LeadData[];
}

export interface StoredLeadResult {
  totalStored: number;
  totalDuplicates: number;
  leads: LeadData[];
}

export interface SourceOptions {
  keyword: string;
  location?: string;
  limit: number;
  config?: SourceConfig;
  state?: string;
  city?: string;
  area?: string;
  businessType?: string;
  sessionId?: string;
}

export abstract class BaseSource {
  protected readonly sourceName: string;
  protected config: SourceConfig;

  constructor(sourceName: string, config?: Partial<SourceConfig>) {
    this.sourceName = sourceName;
    this.config = {
      sourceName,
      baseUrl: '',
      selectors: {
        businessCard: '',
        companyName: '',
      },
      timeout: 30000,
      maxRetries: 3,
      headless: true,
      ...config,
    };
  }

  /**
   * Get source name
   */
  getName(): string {
    return this.sourceName;
  }

  /**
   * Get source configuration
   */
  getConfig(): SourceConfig {
    return this.config;
  }

  /**
   * Scrape leads from the source
   */
  abstract scrape(options: SourceOptions): Promise<ScrapingResult>;

  /**
   * Test source connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.scrape({
        keyword: 'test',
        location: 'test',
        limit: 1,
      });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn({ err: message, source: this.sourceName }, 'Source connection test failed');
      return false;
    }
  }

  /**
   * Store leads in database
   */
  protected async storeLeads(leads: LeadData[], context?: { keyword?: string; location?: string; area?: string; city?: string; state?: string; businessType?: string; fullSearchQuery?: string }): Promise<StoredLeadResult> {
    const persistedLeads: LeadData[] = [];
    let totalStored = 0;
    let totalDuplicates = 0;

    const validLeads = leads.filter(l => l && l.companyName?.trim());
    if (validLeads.length === 0) {
      return { totalStored: 0, totalDuplicates: 0, leads: [] };
    }

    const allConditions: Record<string, unknown>[] = [];
    const leadIndexMap: { index: number; condition: Record<string, unknown> }[] = [];

    for (let i = 0; i < validLeads.length; i++) {
      const lead = validLeads[i];
      const companyName = lead.companyName!.trim();
      const dupConditions: Record<string, unknown>[] = [];

      if (lead.phone && lead.phone.length >= 10) {
        dupConditions.push({ companyName, phone: lead.phone });
      }
      if (lead.website && lead.website.trim().length > 0) {
        dupConditions.push({ website: lead.website.trim() });
      }
      if (lead.address && lead.address.trim().length > 0) {
        dupConditions.push({ companyName, address: lead.address.trim() });
      }
      if (dupConditions.length === 0) {
        dupConditions.push({ companyName, source: this.sourceName });
      }

      allConditions.push({ $or: dupConditions });
      leadIndexMap.push({ index: i, condition: dupConditions[0] });
    }

    const existingLeads = await Lead.find({ $or: allConditions }).lean();

    const phoneMap = new Map<string, ILead>();
    const websiteMap = new Map<string, ILead>();
    const companySourceMap = new Map<string, ILead>();

    for (const el of existingLeads) {
      const lead = el as unknown as ILead;
      if (lead.phone) phoneMap.set(`${lead.companyName}:${lead.phone}`, lead);
      if (lead.website) websiteMap.set(lead.website.trim().toLowerCase(), lead);
      if (lead.companyName && (lead as any).source) {
        companySourceMap.set(`${lead.companyName}:${(lead as any).source}`, lead);
      }
    }

    const inserts: Array<Record<string, unknown>> = [];
    const updates: Array<{ _id: string; lead: LeadData; existing: ILead; changed: boolean }> = [];

    for (const { index } of leadIndexMap) {
      const lead = validLeads[index];
      const companyName = lead.companyName!.trim();

      const phoneKey = lead.phone ? `${companyName}:${lead.phone}` : '';
      const websiteKey = lead.website?.trim().toLowerCase() || '';
      const companySourceKey = `${companyName}:${this.sourceName}`;

      const existing = phoneMap.get(phoneKey) || websiteMap.get(websiteKey) || companySourceMap.get(companySourceKey);

      if (existing) {
        let changed = false;

        const fieldUpdates: Array<{ field: string; value: unknown }> = [];

        if (lead.website && (existing as any).website !== lead.website) {
          fieldUpdates.push({ field: 'website', value: lead.website });
        }
        if (lead.phone && (existing as any).phone !== lead.phone) {
          fieldUpdates.push({ field: 'phone', value: lead.phone });
        }
        if (lead.email && (existing as any).email !== lead.email) {
          fieldUpdates.push({ field: 'email', value: lead.email });
        }
        if (lead.address && (existing as any).address !== lead.address) {
          fieldUpdates.push({ field: 'address', value: lead.address });
        }
        if (lead.category && (existing as any).category !== lead.category) {
          fieldUpdates.push({ field: 'category', value: lead.category });
        }
        if (lead.rating !== undefined && (existing as any).rating !== lead.rating) {
          fieldUpdates.push({ field: 'rating', value: lead.rating });
        }
        if (lead.reviewsCount !== undefined && (existing as any).reviewsCount !== lead.reviewsCount) {
          fieldUpdates.push({ field: 'reviewsCount', value: lead.reviewsCount });
        }
        if (lead.sourceUrl && (existing as any).sourceUrl !== lead.sourceUrl) {
          fieldUpdates.push({ field: 'sourceUrl', value: lead.sourceUrl });
        }
        if (lead.relevanceScore !== undefined && (existing as any).relevanceScore !== lead.relevanceScore) {
          fieldUpdates.push({ field: 'relevanceScore', value: lead.relevanceScore });
        }
        if (lead.validatedCategory && (existing as any).validatedCategory !== lead.validatedCategory) {
          fieldUpdates.push({ field: 'validatedCategory', value: lead.validatedCategory });
        }

        for (const fu of fieldUpdates) {
          (existing as any)[fu.field] = fu.value;
          changed = true;
        }

        if (lead.sources && lead.sources.length > 0) {
          changed = true;
        }

        if (context?.keyword) { (existing as any).searchedKeyword = context.keyword; changed = true; }
        if (context?.location) { (existing as any).searchedLocation = context.location; changed = true; }
        if (context?.area) { (existing as any).searchedArea = context.area; changed = true; }
        if (context?.city) { (existing as any).searchedCity = context.city; changed = true; }
        if (context?.state) { (existing as any).searchedState = context.state; changed = true; }
        if (context?.businessType) { (existing as any).searchedBusinessType = context.businessType; changed = true; }
        if (context?.fullSearchQuery) { (existing as any).fullSearchQuery = context.fullSearchQuery; changed = true; }

        if (lead.semanticCategory) { (existing as any).semanticCategory = lead.semanticCategory; changed = true; }
        if (lead.semanticCategoryName) { (existing as any).semanticCategoryName = lead.semanticCategoryName; changed = true; }
        if (lead.matchedKeyword) { (existing as any).matchedKeyword = lead.matchedKeyword; changed = true; }
        if (lead.originalSearchedKeyword) { (existing as any).originalSearchedKeyword = lead.originalSearchedKeyword; changed = true; }
        if (lead.searchGroup) { (existing as any).searchGroup = lead.searchGroup; changed = true; }
        if (lead.semanticMatchReason) { (existing as any).semanticMatchReason = lead.semanticMatchReason; changed = true; }
        if (lead.expandedFromKeyword) { (existing as any).expandedFromKeyword = lead.expandedFromKeyword; changed = true; }

        (existing as any).extractionSource = this.sourceName as ExtractionSource;
        (existing as any).sourceMetadata = {
          ...((existing as any).sourceMetadata || {}),
          source: this.sourceName,
          extractedAt: new Date().toISOString(),
          searchedKeyword: context?.keyword || (existing as any).searchedKeyword || '',
          searchedLocation: context?.location || (existing as any).searchedLocation || '',
        };
        (existing as any).leadScore = this.calculateLeadScore({
          ...lead,
          companyName,
          website: lead.website || (existing as any).website || undefined,
          phone: lead.phone || (existing as any).phone || undefined,
          address: lead.address || (existing as any).address || undefined,
          category: lead.category || (existing as any).category || undefined,
        });
        changed = true;

        totalDuplicates++;
        persistedLeads.push(this.toLeadData(existing as unknown as ILead, lead));

        if (changed) {
          updates.push({ _id: (existing as any)._id.toString(), lead, existing, changed });
        }
      } else {
        const newLeadData: Record<string, unknown> = {
          companyName,
          website: lead.website || undefined,
          phone: lead.phone || undefined,
          email: lead.email || undefined,
          address: lead.address || undefined,
          category: lead.category || undefined,
          source: this.sourceName,
          rating: lead.rating || undefined,
          reviewsCount: lead.reviewsCount || undefined,
          leadScore: lead.leadScore ?? this.calculateLeadScore(lead),
          sourceUrl: lead.sourceUrl,
          extractionSource: this.sourceName as ExtractionSource,
          relevanceScore: lead.relevanceScore,
          locationConfidence: lead.locationConfidence,
          categoryConfidence: lead.categoryConfidence,
          finalConfidence: lead.finalConfidence,
          validationStatus: lead.validationStatus,
          rejectionReason: lead.rejectionReason,
          aiMatchType: lead.aiMatchType,
          aiWarnings: lead.aiWarnings,
          aiQuality: lead.aiQuality,
          semanticCategory: lead.semanticCategory || '',
          semanticCategoryName: lead.semanticCategoryName || '',
          matchedKeyword: lead.matchedKeyword || '',
          originalSearchedKeyword: lead.originalSearchedKeyword || '',
          searchGroup: lead.searchGroup || '',
          semanticMatchReason: lead.semanticMatchReason || '',
          expandedFromKeyword: lead.expandedFromKeyword || '',
          searchedKeyword: context?.keyword || '',
          searchedLocation: context?.location || '',
          searchedArea: context?.area || '',
          searchedCity: context?.city || '',
          searchedState: context?.state || '',
          searchedBusinessType: context?.businessType || '',
          fullSearchQuery: context?.fullSearchQuery || '',
          sourceMetadata: {
            source: this.sourceName,
            extractedAt: new Date().toISOString(),
            searchedKeyword: context?.keyword || '',
            searchedLocation: context?.location || '',
            searchedArea: context?.area || '',
            searchedCity: context?.city || '',
            searchedState: context?.state || '',
            searchedBusinessType: context?.businessType || '',
            fullSearchQuery: context?.fullSearchQuery || '',
          },
        };

        classifyLeadWebsite(newLeadData, lead.website);
        inserts.push(newLeadData);
      }
    }

    if (inserts.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < inserts.length; i += batchSize) {
        const batch = inserts.slice(i, i + batchSize);
        const created = await Lead.insertMany(batch, { ordered: false });
        for (let j = 0; j < created.length; j++) {
          const idx = i + j;
          if (idx < validLeads.length) {
            persistedLeads.push(this.toLeadData(created[j] as unknown as ILead, validLeads[idx]));
          }
        }
      }
      totalStored = inserts.length;
    }

    if (updates.length > 0) {
      const bulkOps = updates.map(u => ({
        updateOne: {
          filter: { _id: u._id as any },
          update: { $set: u.existing as any },
        },
      }));

      const batchSize = 100;
      for (let i = 0; i < bulkOps.length; i += batchSize) {
        const batch = bulkOps.slice(i, i + batchSize);
        await Lead.bulkWrite(batch).catch((err) => {
          logger.warn({ err: err.message }, 'Store leads bulk update failed');
        });
      }
    }

    logger.info({ totalStored, totalDuplicates, totalLeads: leads.length }, 'storeLeads completed');
    return { totalStored, totalDuplicates, leads: persistedLeads };
  }

  private toLeadData(document: ILead, scrapedLead: LeadData): LeadData {
    return {
      id: document._id.toString(),
      companyName: document.companyName,
      website: document.website ?? undefined,
      phone: document.phone ?? undefined,
      email: document.email ?? undefined,
      address: document.address ?? undefined,
      category: document.category ?? undefined,
      rating: document.rating ?? undefined,
      reviewsCount: document.reviewsCount ?? undefined,
      source: document.source,
      sourceUrl: document.sourceUrl ?? undefined,
      leadScore: document.leadScore ?? undefined,
      href: scrapedLead.href,
      placeId: scrapedLead.placeId,
      createdAt: document.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * Check if lead is duplicate
   */
  protected isDuplicate(business: LeadData, existing: LeadData[]): boolean {
    return existing.some(
      (b) => b.companyName === business.companyName && b.phone === business.phone
    );
  }

  /**
   * Calculate lead score
   */
  protected calculateLeadScore(data: LeadData): number {
    let score = 30;
    if (data.website) score += 20;
    if (data.phone) score += 15;
    if (data.email) score += 15;
    if (data.address) score += 5;
    if (data.category) score += 5;
    if (data.rating && data.rating >= 4.5) score += 10;
    else if (data.rating && data.rating >= 4.0) score += 5;
    return Math.min(score, 100);
  }
}
