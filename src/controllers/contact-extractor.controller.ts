import { Request, Response, NextFunction } from 'express';
import { contactExtractorService } from '../services/contact-extractor.service';
import { websiteCrawlerService } from '../services/website-crawler.service';
import { socialExtractorService } from '../services/social-extractor.service';
import { ownerDetectorService } from '../services/owner-detector.service';
import { contactPageDetectorService } from '../services/contact-page-detector.service';
import { APIResponse } from '../utils/api-response';
import { LeadService } from '../services/lead.service';
import { logger } from '../utils/logger';

export class ContactExtractorController {
  private leadService: LeadService;

  constructor() {
    this.leadService = new LeadService();
  }

  /**
   * Extract contacts from a single lead
   */
  async extractContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      const lead = await this.leadService.getLeadById(leadId);

      if (!lead) {
        APIResponse.error(res, 'Lead not found', null, 404);
        return;
      }

      if (!lead.website) {
        APIResponse.error(res, 'Lead has no website', null, 400);
        return;
      }

      APIResponse.success(res, {
        leadId,
        status: 'processing',
        message: 'Contact extraction started in background',
      }, 'Contact extraction queued');

      setImmediate(async () => {
        try {
          const extractionResult = await contactExtractorService.extractContacts(lead.website!);

          const updateData: Record<string, unknown> = {
            emails: extractionResult.emails,
            phones: extractionResult.phones,
            socialLinks: {
              ...(lead.socialLinks || {}),
              ...extractionResult.socialLinks,
            },
            contactPages: extractionResult.contactPages,
            ownerNames: extractionResult.ownerNames,
            extractionStatus: extractionResult.extractionStatus,
            extractedAt: new Date(),
          };

          if (extractionResult.extractionStatus === 'success') {
            updateData.aiLeadScore = lead.leadScore;
            updateData.aiQualificationLevel = lead.qualificationLevel;
          }

          await this.leadService.updateLead(leadId, updateData);
          logger.info({ leadId, status: extractionResult.extractionStatus }, 'Contact extraction completed in background');
        } catch (bgError) {
          logger.error({ leadId, err: bgError instanceof Error ? bgError.message : String(bgError) }, 'Background contact extraction failed');
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk extract contacts from multiple leads
   */
  async bulkExtractContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 50 } = req.body;

      // Get leads with websites
      const leads = await this.leadService.getAllLeads({
        limit: 1000,
      });

      if (leads.leads.length === 0) {
        APIResponse.success(res, {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
        }, 'No leads found for extraction');
        return;
      }

      // Filter leads with websites
      const leadsWithWebsites = leads.leads
        .filter((lead: any) => !!lead.website)
        .slice(0, limit);

      if (leadsWithWebsites.length === 0) {
        APIResponse.success(res, {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
        }, 'No leads with websites found');
        return;
      }

      // Extract contacts in bulk
      const extractionResult = await contactExtractorService.bulkExtractContacts(
        leadsWithWebsites.map((lead: any) => ({ id: lead.id, website: lead.website }))
      );

      // Update leads in database
      for (const result of extractionResult.results) {
        if (result.result.extractionStatus === 'success') {
          await this.leadService.updateLead(result.leadId, {
            emails: result.result.emails,
            phones: result.result.phones,
            socialLinks: {
              facebook: result.result.socialLinks.facebook,
              instagram: result.result.socialLinks.instagram,
              linkedin: result.result.socialLinks.linkedin,
              twitter: result.result.socialLinks.twitter,
              youtube: result.result.socialLinks.youtube,
            },
            contactPages: result.result.contactPages,
            ownerNames: result.result.ownerNames,
            extractionStatus: result.result.extractionStatus,
            extractedAt: new Date(),
          });
        }
      }

      APIResponse.success(res, {
        totalProcessed: extractionResult.totalProcessed,
        successful: extractionResult.successful,
        failed: extractionResult.failed,
        results: extractionResult.results.map(r => ({
          leadId: r.leadId,
          emails: r.result.emails,
          phones: r.result.phones,
          socialLinks: r.result.socialLinks,
          extractionStatus: r.result.extractionStatus,
        })),
      }, 'Bulk extraction completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crawl website for contact information
   */
  async crawlWebsite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      // Get the lead
      const lead = await this.leadService.getLeadById(leadId);

      if (!lead || !lead.website) {
        APIResponse.error(res, 'Lead or website not found', null, 404);
        return;
      }

      // Crawl website
      const crawlResult = await websiteCrawlerService.crawlAndExtractContacts(lead.website);

      // Update lead
      await this.leadService.updateLead(leadId, {
        emails: crawlResult.emails,
        phones: crawlResult.phones,
        socialLinks: {
          ...(lead.socialLinks || {}),
          ...crawlResult.socialLinks,
        },
        extractedAt: new Date(),
      });

      APIResponse.success(res, {
        leadId,
        crawledPages: crawlResult.crawledPages,
        emails: crawlResult.emails,
        phones: crawlResult.phones,
        socialLinks: crawlResult.socialLinks,
      }, 'Website crawl completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extract social media links
   */
  async extractSocialLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      // Get the lead
      const lead = await this.leadService.getLeadById(leadId);

      if (!lead || !lead.website) {
        APIResponse.error(res, 'Lead or website not found', null, 404);
        return;
      }

      // Extract social links
      const socialLinks = await socialExtractorService.extractSocialLinks(lead.website);

      // Update lead
      await this.leadService.updateLead(leadId, {
        socialLinks: {
          ...(lead.socialLinks || {}),
          ...socialLinks,
        },
        extractedAt: new Date(),
      });

      APIResponse.success(res, {
        leadId,
        socialLinks,
      }, 'Social links extracted');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Detect owner/finder from website
   */
  async detectOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      // Get the lead
      const lead = await this.leadService.getLeadById(leadId);

      if (!lead || !lead.website) {
        APIResponse.error(res, 'Lead or website not found', null, 404);
        return;
      }

      // Detect owner
      const ownerResult = await ownerDetectorService.detectOwner(lead.website);

      // Update lead
      await this.leadService.updateLead(leadId, {
        ownerNames: ownerResult.ownerNames,
        extractedAt: new Date(),
      });

      APIResponse.success(res, {
        leadId,
        ...ownerResult,
      }, 'Owner detection completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Detect contact pages
   */
  async detectContactPages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      // Get the lead
      const lead = await this.leadService.getLeadById(leadId);

      if (!lead || !lead.website) {
        APIResponse.error(res, 'Lead or website not found', null, 404);
        return;
      }

      // Detect contact pages
      const contactPages = await contactPageDetectorService.detectContactPages(lead.website);

      // Update lead
      await this.leadService.updateLead(leadId, {
        contactPages: contactPages.map(page => page.url),
        extractedAt: new Date(),
      });

      APIResponse.success(res, {
        leadId,
        contactPages,
      }, 'Contact pages detected');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Full extraction for a lead
   */
  async fullExtraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.body;

      if (!leadId) {
        APIResponse.error(res, 'leadId is required', null, 400);
        return;
      }

      // Get the lead
      const lead = await this.leadService.getLeadById(leadId);

      if (!lead || !lead.website) {
        APIResponse.error(res, 'Lead or website not found', null, 404);
        return;
      }

      const [contactResult, socialResult, ownerResult, contactPageResult] = await Promise.all([
        contactExtractorService.extractContacts(lead.website),
        socialExtractorService.extractSocialLinks(lead.website),
        ownerDetectorService.detectOwner(lead.website),
        contactPageDetectorService.detectContactPages(lead.website),
      ]);

      // Update lead with all results
      const updateData: any = {
        emails: contactResult.emails,
        phones: contactResult.phones,
        socialLinks: {
          ...(lead.socialLinks || {}),
          ...contactResult.socialLinks,
          ...socialResult,
        },
        contactPages: [...new Set([...contactResult.contactPages, ...contactPageResult.map(p => p.url)])],
        ownerNames: [...new Set([...contactResult.ownerNames, ...ownerResult.ownerNames])],
        extractionStatus: contactResult.extractionStatus,
        extractedAt: new Date(),
      };

      await this.leadService.updateLead(leadId, updateData);

      APIResponse.success(res, {
        leadId,
        contactExtraction: contactResult,
        socialLinks: socialResult,
        ownerInfo: ownerResult,
        contactPages: contactPageResult,
      }, 'Full extraction completed');
    } catch (error) {
      next(error);
    }
  }
}

export const contactExtractorController = new ContactExtractorController();
