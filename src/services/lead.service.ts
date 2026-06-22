import { FilterQuery } from 'mongoose';
import { Lead, ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import { QualificationLevel, WebsiteStatus } from '../types/analysis.types';
import { websiteAnalysisService } from './website-analysis.service';
import { auditCache } from './audit-cache.service';

export interface LeadSortOptions {
  field?: 'leadScore' | 'createdAt' | 'companyName' | 'rating' | 'finalConfidence';
  order?: 'asc' | 'desc';
}

export interface LeadQueryOptions {
  page?: number;
  limit?: number;
  keyword?: string;
  location?: string;
  state?: string;
  city?: string;
  area?: string;
  businessType?: string;
  category?: string;
  source?: string;
  sources?: string[];
  minRating?: number;
  minLeadScore?: number;
  maxLeadScore?: number;
  websiteStatus?: WebsiteStatus;
  qualificationLevel?: QualificationLevel;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  sort?: LeadSortOptions;
  minConfidence?: number;
  maxConfidence?: number;
  validationStatus?: 'validated' | 'rejected' | 'needs-review';
  aiQuality?: 'excellent' | 'good' | 'average' | 'poor';
}

export interface LeadSearchResult {
  leads: ILead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class LeadService {
  async getAllLeads(options: LeadQueryOptions = {}): Promise<LeadSearchResult> {
    const {
      page = 1,
      limit = 10,
      keyword,
      location,
      state,
      city,
      area,
      category,
      source,
      sources,
      minRating,
      minLeadScore,
      maxLeadScore,
      websiteStatus,
      qualificationLevel,
      hasWebsite,
      hasPhone,
      sort,
      businessType,
    } = options;

    logger.debug(`LeadService: Fetching leads (page: ${page}, limit: ${limit})`);

    const query: FilterQuery<ILead> = {};
    const andClauses: FilterQuery<ILead>[] = [];

    if (keyword) {
      andClauses.push({ $or: [
        { companyName: { $regex: keyword, $options: 'i' } },
        { website: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword } },
        { address: { $regex: keyword, $options: 'i' } },
        { category: { $regex: keyword, $options: 'i' } },
        { searchedKeyword: { $regex: keyword, $options: 'i' } },
      ] });
    }

    // Build location query from state/city/area if provided
    if (state && city) {
      let locationQuery = city;
      if (state) {
        locationQuery = `${city}, ${state}`;
      }
      if (area) {
        locationQuery = `${area}, ${city}, ${state}`;
      }
      andClauses.push({ $or: [
        { address: { $regex: locationQuery, $options: 'i' } },
        { companyName: { $regex: locationQuery, $options: 'i' } },
        { category: { $regex: locationQuery, $options: 'i' } },
        { searchedLocation: { $regex: locationQuery, $options: 'i' } },
      ] });
    } else if (location) {
      // Fallback to plain location if state/city not provided
      andClauses.push({ $or: [
        { address: { $regex: location, $options: 'i' } },
        { companyName: { $regex: location, $options: 'i' } },
        { category: { $regex: location, $options: 'i' } },
        { searchedLocation: { $regex: location, $options: 'i' } },
      ] });
    }

    if (area) {
      andClauses.push({ searchedArea: { $regex: area, $options: 'i' } });
    }

    if (city && !area) {
      andClauses.push({ searchedCity: { $regex: city, $options: 'i' } });
    }

    if (state && !area && !city) {
      andClauses.push({ searchedState: { $regex: state, $options: 'i' } });
    }

    if (businessType) {
      andClauses.push({ searchedBusinessType: { $regex: businessType, $options: 'i' } });
    }

    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    if (source) {
      query.source = source;
    }

    if (sources && sources.length > 0) {
      query.source = { $in: sources };
    }

    if (minRating !== undefined) {
      query.rating = { $gte: minRating };
    }

    if (minLeadScore !== undefined) {
      query.leadScore = { ...(query.leadScore || {}), $gte: minLeadScore };
    }

    if (maxLeadScore !== undefined) {
      query.leadScore = { ...(query.leadScore || {}), $lte: maxLeadScore };
    }

    if (websiteStatus) {
      query.websiteStatus = websiteStatus;
    }

    if (qualificationLevel) {
      query.qualificationLevel = qualificationLevel;
    }

    if (hasWebsite === true) {
      andClauses.push({ website: { $exists: true, $nin: [null, ''] } });
    } else if (hasWebsite === false) {
      andClauses.push({ $or: [{ website: { $exists: false } }, { website: null }, { website: '' }] });
    }

    if (hasPhone === true) {
      andClauses.push({ phone: { $exists: true, $nin: [null, ''] } });
    } else if (hasPhone === false) {
      andClauses.push({ $or: [{ phone: { $exists: false } }, { phone: null }, { phone: '' }] });
    }

    if (options.minConfidence !== undefined) {
      andClauses.push({ finalConfidence: { $gte: options.minConfidence } });
    }

    if (options.maxConfidence !== undefined) {
      andClauses.push({ finalConfidence: { $lte: options.maxConfidence } });
    }

    if (options.validationStatus) {
      andClauses.push({ validationStatus: options.validationStatus });
    }

    if (options.aiQuality) {
      andClauses.push({ aiQuality: options.aiQuality });
    }

    if (andClauses.length > 0) {
      query.$and = andClauses;
    }

    // Apply sorting — newest first
    let sortOptions: Record<string, 1 | -1> = {};
    if (sort && sort.field) {
      const order = sort.order === 'asc' ? 1 : -1;
      sortOptions[sort.field] = order;
    } else {
      sortOptions = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;
    
    const [total, rawLeads] = await Promise.all([
      Lead.countDocuments(query),
      Lead.find(query).sort(sortOptions).skip(skip).limit(limit).lean(),
    ]);
    
    const leads = (rawLeads as any[]).map(lead => ({
      ...lead,
      id: (lead as any)._id ? (lead as any)._id.toString() : lead.id,
    }));

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getLeadById(id: string): Promise<ILead | null> {
    const lead = await Lead.findById(id).lean();

    if (!lead) {
      logger.warn(`LeadService: Lead not found with ID: ${id}`);
    }

    return lead as ILead | null;
  }

  async createLead(data: Partial<ILead>): Promise<ILead> {
    const analysis = websiteAnalysisService.getLeadFields(data.website);
    const enrichedData: Record<string, unknown> = {
      ...data,
      website: analysis.website,
      hasWebsite: analysis.hasWebsite,
      normalizedDomain: analysis.normalizedDomain,
      analysisEligible: analysis.analysisEligible,
      hasRealWebsite: analysis.hasRealWebsite,
      websiteType: analysis.websiteType,
      websiteAuditAllowed: analysis.websiteAuditAllowed,
    };
    const lead = new Lead(enrichedData);
    await lead.save();
    logger.debug(`LeadService: Created lead - ${lead.companyName} (analysisEligible=${analysis.analysisEligible})`);
    return lead;
  }

  async updateLead(id: string, data: Partial<ILead>): Promise<ILead | null> {
    logger.debug(`LeadService: Updating lead with ID: ${id}`);

    const updateData: Record<string, unknown> = { ...data };
    if (updateData.website !== undefined) {
      const existingLead = await Lead.findById(id).select('website').lean();
      const oldWebsite = existingLead?.website;

      if (oldWebsite && oldWebsite !== updateData.website) {
        auditCache.clear();
        logger.info(`[LeadService] Website changed for lead ${id}: "${oldWebsite}" → "${updateData.website}" — invalidated all caches`);
      }

      const analysis = websiteAnalysisService.getLeadFields(updateData.website as string | null | undefined);
      updateData.website = analysis.website;
      updateData.hasWebsite = analysis.hasWebsite;
      updateData.normalizedDomain = analysis.normalizedDomain;
      updateData.analysisEligible = analysis.analysisEligible;
      updateData.hasRealWebsite = analysis.hasRealWebsite;
      updateData.websiteType = analysis.websiteType;
      updateData.websiteAuditAllowed = analysis.websiteAuditAllowed;
    }

    const lead = await Lead.findByIdAndUpdate(id, updateData, { new: true });

    if (!lead) {
      logger.warn(`LeadService: Lead not found with ID: ${id}`);
    }

    return lead;
  }

  async deleteLead(id: string): Promise<boolean> {
    logger.debug(`LeadService: Deleting lead with ID: ${id}`);

    const result = await Lead.findByIdAndDelete(id);

    return !!result;
  }

  async bulkCreateLeads(leads: Partial<ILead>[]): Promise<{ created: number; duplicates: number }> {
    let created = 0;
    let duplicates = 0;

    for (const lead of leads) {
      try {
        const existing = await Lead.findOne({
          $or: [
            { companyName: lead.companyName, phone: lead.phone },
            { website: lead.website },
          ],
        });

        if (existing) {
          duplicates++;
          continue;
        }

        const analysis = websiteAnalysisService.getLeadFields(lead.website);
        const enrichedData: Record<string, unknown> = {
          ...lead,
          website: analysis.website,
          hasWebsite: analysis.hasWebsite,
          normalizedDomain: analysis.normalizedDomain,
          analysisEligible: analysis.analysisEligible,
          hasRealWebsite: analysis.hasRealWebsite,
          websiteType: analysis.websiteType,
          websiteAuditAllowed: analysis.websiteAuditAllowed,
        };

        const newLead = new Lead(enrichedData);
        await newLead.save();
        created++;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ err: message }, 'LeadService: Failed to create lead');
        duplicates++;
      }
    }

    logger.debug(`LeadService: Bulk create completed - ${created} created, ${duplicates} duplicates`);

    return { created, duplicates };
  }

  async deleteAllLeads(): Promise<{ deletedCount: number }> {
    logger.warn('LeadService: Deleting ALL leads from database');
    const result = await Lead.deleteMany({});
    logger.warn(`LeadService: Deleted ${result.deletedCount} leads`);
    return { deletedCount: result.deletedCount };
  }

  async getDistinctCategories(): Promise<string[]> {
    const categories = await Lead.distinct('category', {
      category: { $exists: true, $nin: [null, ''] },
    });
    return categories.sort();
  }

  async getDuplicateCheck(companyName: string, phone?: string): Promise<boolean> {
    const query: any = { companyName };

    if (phone) {
      query.phone = phone;
    }

    const existing = await Lead.findOne(query);
    return !!existing;
  }
}
