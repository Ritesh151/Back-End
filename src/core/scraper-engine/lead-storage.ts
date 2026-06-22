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
}

export type StorageContextRecord = StorageContext & Record<string, unknown>;

export class LeadStorage {
  async storeLeads(
    leads: ScraperLead[],
    context: StorageContextRecord
  ): Promise<StorageResult> {
    const stored: ScraperLead[] = [];
    let totalStored = 0;
    let totalDuplicates = 0;

    for (const lead of leads) {
      if (!this.validateLead(lead)) {
        if (context.sessionId) {
          searchStatus.incrementFailed(context.sessionId as string);
        }
        continue;
      }
      try {
        const normalized = leadNormalizer.normalize(lead, {
          ...context,
          source: lead.source,
        });

        const dedupKeys = leadNormalizer.getDedupKey(normalized);
        const duplicate = await this.findDuplicate(dedupKeys);

        if (duplicate) {
          await this.updateExistingLead(duplicate, normalized, context);
          totalDuplicates++;
          stored.push(normalized);
          if (context.sessionId) {
            searchStatus.incrementDuplicates(context.sessionId as string);
          }
          continue;
        }

        const newLead = new Lead({
          companyName: normalized.companyName,
          website: normalized.website || undefined,
          phone: normalized.phone || undefined,
          email: normalized.email || undefined,
          address: normalized.address || undefined,
          category: normalized.category || undefined,
          source: normalized.source,
          rating: normalized.rating || undefined,
          reviewsCount: normalized.reviewsCount || undefined,
          leadScore: this.calculateLeadScore(normalized),
          sourceUrl: normalized.sourceUrl,
          extractionSource: normalized.source,
          relevanceScore: normalized.relevanceScore || 0,
          locationConfidence: normalized.locationRelevanceScore || 0,
          searchedKeyword: context.keyword || '',
          searchedLocation: context.location || '',
          searchedArea: context.area || '',
          searchedCity: context.city || '',
          searchedState: context.state || '',
          searchedBusinessType: context.businessType || '',
          fullSearchQuery: context.fullSearchQuery || '',
          semanticKeyword: context.semanticKeyword || context.keyword,
          searchSessionId: context.sessionId || undefined,
          pincode: (normalized as any).pincode || undefined,
          latitude: (normalized as any).latitude || undefined,
          longitude: (normalized as any).longitude || undefined,
          sourceMetadata: {
            source: normalized.source,
            placeId: (normalized as any).placeId || undefined,
            extractedAt: new Date().toISOString(),
            searchedKeyword: context.keyword || '',
            searchedLocation: context.location || '',
            searchedArea: context.area || '',
            searchedCity: context.city || '',
            searchedState: context.state || '',
            semanticKeyword: context.semanticKeyword || context.keyword,
          },
        });

        await newLead.save();
        totalStored++;
        stored.push(normalized);
        if (context.sessionId) {
          searchStatus.incrementSaved(context.sessionId as string);
          searchStatus.addLiveLead(context.sessionId as string, normalized.companyName, normalized.source);
        }

        aiProcessingQueue.enqueueLead(newLead._id.toString()).catch((err: unknown) => {
          logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'LeadStorage: Auto-enqueue failed');
        });

        if (normalized.website) {
          setImmediate(async () => {
            try {
              await businessEmailDiscoveryService.discoverEmailsForLead(newLead._id.toString());
            } catch (err: unknown) {
              logger.warn({ err: err instanceof Error ? err.message : String(err), leadId: newLead._id.toString() }, 'LeadStorage: Email discovery failed');
            }
          });
        }

        logger.info({
          company: normalized.companyName,
          source: normalized.source,
        }, 'LeadStorage: Lead saved');
      } catch (error) {
        if (context.sessionId) {
          searchStatus.incrementFailed(context.sessionId as string);
        }
        logger.warn({
          err: error instanceof Error ? error.message : String(error),
          company: lead.companyName,
        }, 'LeadStorage: Save failed');
      }
    }

    logger.info({
      totalStored,
      totalDuplicates,
      totalInput: leads.length,
      validCount: leads.length,
    }, 'LeadStorage: Batch complete');

    return { totalStored, totalDuplicates, leads: stored };
  }

  private validateLead(lead: ScraperLead): boolean {
    if (!lead.companyName || lead.companyName.trim().length < 2) return false;
    if (!lead.phone && !lead.website && !lead.address) return false;
    if (lead.source === 'google-maps' && !lead.placeId && !lead.href) return false;
    return true;
  }

  private async findDuplicate(keys: string[]): Promise<boolean> {
    if (keys.length === 0) return false;
    const conditions: Record<string, unknown>[] = [];

    for (const key of keys) {
      if (key.startsWith('phone:')) {
        conditions.push({ phone: key.replace('phone:', '') });
      } else if (key.startsWith('website:')) {
        conditions.push({ website: key.replace('website:', '') });
      } else if (key.startsWith('placeId:')) {
        conditions.push({ 'sourceMetadata.placeId': key.replace('placeId:', '') });
      } else if (key.startsWith('name:')) {
        const parts = key.replace('name:', '').split('|');
        const nameKey = parts[0];
        conditions.push({ companyName: { $regex: new RegExp(`^${nameKey}$`, 'i') } });
      }
    }

    if (conditions.length === 0) return false;

    const existing = await Lead.findOne({ $or: conditions }).catch(() => null);
    return !!existing;
  }

  private async updateExistingLead(
    _existing: boolean,
    _lead: ScraperLead,
    _context: Record<string, unknown>
  ): Promise<void> {
    // dedup already handled, updates managed by base-source.ts
  }

  private calculateLeadScore(lead: ScraperLead): number {
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
}

export const leadStorage = new LeadStorage();
