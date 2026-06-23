import { Lead } from '../../models/Lead';
import { logger } from '../../utils/logger';
import { ScraperLead } from './types';
import { leadNormalizer } from './lead-normalizer';
import { aiProcessingQueue } from '../../services/ai-processing-queue.service';
import { searchStatus } from '../../services/search-status.service';
import { businessEmailDiscoveryService } from '../../services/business-email-discovery.service';

export interface StorageResult {
  totalStored: number;
  totalDuplicates: number;
  leads: ScraperLead[];
}

export interface StorageContext {
  keyword: string;
  location: string;
  area?: string;
  city?: string;
  state?: string;
  businessType: string;
  fullSearchQuery?: string;
  semanticKeyword?: string;
  sessionId?: string;
}

export type StorageContextRecord = StorageContext & Record<string, unknown>;

const BATCH_SIZE = 100;

function calcScore(lead: ScraperLead): number {
  let score = 30;
  if (lead.website) score += 20;
  if (lead.phone) score += 15;
  if (lead.email) score += 15;
  if (lead.address) score += 5;
  if (lead.category) score += 5;
  if (lead.rating && lead.rating >= 4.5) score += 10;
  else if (lead.rating && lead.rating >= 4.0) score += 5;
  if (lead.reviewsCount && lead.reviewsCount > 50) score += 5;
  if (lead.reviewsCount && lead.reviewsCount > 10) score += 3;
  return Math.min(score, 100);
}

function buildDoc(lead: ScraperLead, ctx: StorageContextRecord): Record<string, unknown> {
  return {
    companyName: lead.companyName,
    website: lead.website || undefined,
    phone: lead.phone || undefined,
    email: lead.email || undefined,
    address: lead.address || undefined,
    category: lead.category || undefined,
    source: lead.source,
    rating: lead.rating || undefined,
    reviewsCount: lead.reviewsCount || undefined,
    leadScore: calcScore(lead),
    sourceUrl: lead.sourceUrl,
    extractionSource: lead.source,
    relevanceScore: lead.relevanceScore || 0,
    locationConfidence: lead.locationRelevanceScore || 0,
    searchedKeyword: ctx.keyword || '',
    searchedLocation: ctx.location || '',
    searchedArea: ctx.area || '',
    searchedCity: ctx.city || '',
    searchedState: ctx.state || '',
    searchedBusinessType: ctx.businessType || '',
    fullSearchQuery: ctx.fullSearchQuery || '',
    semanticKeyword: ctx.semanticKeyword || ctx.keyword,
    searchSessionId: ctx.sessionId || undefined,
    pincode: (lead as any).pincode || undefined,
    latitude: (lead as any).latitude || undefined,
    longitude: (lead as any).longitude || undefined,
    sourceMetadata: {
      source: lead.source,
      placeId: (lead as any).placeId || undefined,
      extractedAt: new Date().toISOString(),
      searchedKeyword: ctx.keyword || '',
      searchedLocation: ctx.location || '',
      searchedArea: ctx.area || '',
      searchedCity: ctx.city || '',
      searchedState: ctx.state || '',
      semanticKeyword: ctx.semanticKeyword || ctx.keyword,
    },
  };
}

export class LeadStorage {
  async storeLeads(
    leads: ScraperLead[],
    context: StorageContextRecord
  ): Promise<StorageResult> {
    const stored: ScraperLead[] = [];
    let totalStored = 0;
    let totalDuplicates = 0;

    const validLeads: ScraperLead[] = [];
    for (const lead of leads) {
      if (this.validateLead(lead)) {
        validLeads.push(leadNormalizer.normalize(lead, {
          ...context,
          source: lead.source,
        }));
      } else {
        if (context.sessionId) {
          searchStatus.incrementFailed(context.sessionId as string);
        }
      }
    }

    if (validLeads.length === 0) {
      return { totalStored: 0, totalDuplicates: 0, leads: [] };
    }

    const phoneKeys = validLeads
      .map(l => l.phone?.replace(/[^\d+]/g, ''))
      .filter(Boolean) as string[];

    const websiteKeys = validLeads
      .map(l => l.website?.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, ''))
      .filter(Boolean) as string[];

    const existingMap = new Map<string, true>();
    if (phoneKeys.length > 0 || websiteKeys.length > 0) {
      const conditions: Record<string, unknown>[] = [];
      if (phoneKeys.length > 0) {
        conditions.push({ phone: { $in: [...new Set(phoneKeys)] } });
      }
      if (websiteKeys.length > 0) {
        conditions.push({ website: { $in: [...new Set(websiteKeys)] } });
      }

      const existing = await Lead.find(
        { $or: conditions },
        { phone: 1, website: 1, _id: 0 }
      ).lean();

      for (const doc of existing) {
        const d = doc as { phone?: string; website?: string };
        if (d.phone) existingMap.set(`phone:${d.phone.replace(/[^\d+]/g, '')}`, true);
        if (d.website) existingMap.set(`website:${d.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')}`, true);
      }
    }

    const uniqueLeads: ScraperLead[] = [];
    for (const lead of validLeads) {
      const phone = lead.phone?.replace(/[^\d+]/g, '');
      const website = lead.website?.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
      const isDup = (phone && existingMap.has(`phone:${phone}`)) || (website && existingMap.has(`website:${website}`));
      if (isDup) {
        totalDuplicates++;
        stored.push(lead);
      } else {
        uniqueLeads.push(lead);
      }
    }

    for (let i = 0; i < uniqueLeads.length; i += BATCH_SIZE) {
      const batch = uniqueLeads.slice(i, i + BATCH_SIZE);
      try {
        const docs = batch.map(lead => buildDoc(lead, context));
        const created = await Lead.insertMany(docs, { ordered: false });
        const ids = created.map(doc => doc._id.toString());

        stored.push(...batch.slice(0, ids.length));
        totalStored += ids.length;

        for (let j = 0; j < ids.length; j++) {
          const idx = j;
          aiProcessingQueue.enqueueLead(ids[idx]).catch(() => {});
          if (context.sessionId) {
            searchStatus.incrementSaved(context.sessionId as string);
            searchStatus.addLiveLead(context.sessionId as string, batch[idx].companyName, batch[idx].source);
          }
          if (batch[idx].website) {
            setImmediate(() => {
              businessEmailDiscoveryService.discoverEmailsForLead(ids[idx]).catch(() => {});
            });
          }
        }
      } catch (err: any) {
        if (err.code === 11000 || (err.writeErrors && err.writeErrors.length > 0)) {
          const insertedCount = err.insertedDocs?.length || 0;
          const dupCount = batch.length - insertedCount;
          totalStored += insertedCount;
          totalDuplicates += dupCount;
          if (insertedCount > 0) {
            stored.push(...batch.slice(0, insertedCount));
          }
        } else {
          logger.warn({ err: err.message }, 'LeadStorage: Batch insert failed');
          if (context.sessionId) {
            searchStatus.incrementFailed(context.sessionId as string, batch.length);
          }
        }
      }
    }

    logger.info({
      totalStored,
      totalDuplicates,
      totalInput: leads.length,
      validCount: validLeads.length,
    }, 'LeadStorage: Batch complete');

    return { totalStored, totalDuplicates, leads: stored };
  }

  private validateLead(lead: ScraperLead): boolean {
    if (!lead.companyName || lead.companyName.trim().length < 2) return false;
    if (!lead.phone && !lead.website && !lead.address) return false;
    if (lead.source === 'google-maps' && !lead.placeId && !lead.href) return false;
    return true;
  }

  //
}

export const leadStorage = new LeadStorage();
