import { logger } from '../utils/logger';
import { contactExtractorService } from '../services/contact-extractor.service';
import { Lead } from '../models/Lead';
import { JobExecution } from '../models/Automation';

export interface ContactExtractionOptions {
  automationId: string;
  leadIds: string[];
}

export class ContactExtractionJob {
  /**
   * Execute contact extraction job
   */
  async execute(options: ContactExtractionOptions): Promise<{
    success: boolean;
    extractedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const { automationId, leadIds } = options;

    logger.info(`ContactExtractionJob: Starting extraction for ${leadIds.length} leads`);

    const jobExecution = await this.createJobExecution(automationId, 'contact-extraction', {
      leadIdsCount: leadIds.length,
    });

    let extractedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const leadId of leadIds) {
      try {
        const lead = await Lead.findById(leadId);

        if (!lead || !lead.website) {
          failedCount++;
          errors.push(`Lead ${leadId}: No website`);
          continue;
        }

        // Extract contacts
        const extractionResult = await contactExtractorService.extractContacts(lead.website);

        // Update lead with extraction results
        await Lead.findByIdAndUpdate(leadId, {
          emails: extractionResult.emails,
          phones: extractionResult.phones,
          socialLinks: {
            facebook: extractionResult.socialLinks.facebook,
            instagram: extractionResult.socialLinks.instagram,
            linkedin: extractionResult.socialLinks.linkedin,
            twitter: extractionResult.socialLinks.twitter,
            youtube: extractionResult.socialLinks.youtube,
          },
          contactPages: extractionResult.contactPages,
          ownerNames: extractionResult.ownerNames,
          extractionStatus: extractionResult.extractionStatus,
          extractedAt: new Date(),
        });

        extractedCount++;

        // Add log
        jobExecution.logs.push(`Extracted ${lead.companyName}: ${extractionResult.emails.length} emails, ${extractionResult.phones.length} phones`);

        await jobExecution.save();

      } catch (error: any) {
        logger.warn(`ContactExtractionJob: Failed for lead ${leadId}:`, error.message);
        failedCount++;
        errors.push(error.message);
      }
    }

    // Update job execution
    await this.updateJobExecution(jobExecution.id, {
      status: 'completed',
      totalLeadsGenerated: extractedCount,
      completedAt: new Date(),
    });

    logger.info(`ContactExtractionJob: Completed - ${extractedCount} extracted, ${failedCount} failed`);

    return {
      success: extractedCount > 0,
      extractedCount,
      failedCount,
      errors,
    };
  }

  /**
   * Create job execution record
   */
  private async createJobExecution(
    automationId: string,
    jobType: string,
    metadata: any
  ): Promise<any> {
    const jobExecution = new JobExecution({
      automationId,
      jobType,
      status: 'running',
      startedAt: new Date(),
      metadata,
      logs: [],
    });

    return await jobExecution.save();
  }

  /**
   * Update job execution record
   */
  private async updateJobExecution(jobExecutionId: string, updates: any): Promise<void> {
    await JobExecution.findByIdAndUpdate(jobExecutionId, updates);
  }
}

export const contactExtractionJob = new ContactExtractionJob();
