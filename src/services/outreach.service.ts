import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { outreachReportGenerator } from '../ai-outreach/outreach-report-generator';
import { outreachHistoryService } from '../ai-outreach/outreach-history.service';
import { LeadInput } from '../ai-outreach/ai-outreach.types';

export class OutreachService {
  async generateOutreachForLead(leadId: string) {
    const lead = await Lead.findById(leadId).lean();
    if (!lead) {
      throw new Error('Lead not found');
    }

    const leadInput = this.toLeadInput(lead);

    logger.info(`Generating outreach materials for lead ${leadId}: ${leadInput.companyName}`);

    const report = outreachReportGenerator.generateFullReport(leadId, leadInput);

    await Lead.findByIdAndUpdate(leadId, {
      $set: {
        generatedEmails: report.emails,
        generatedWhatsAppMessages: report.whatsappMessages,
        generatedProposals: report.proposals,
        followupSequence: report.followupSequence,
        outreachProbability: report.outreachScore.outreachProbability,
        outreachProbabilityScore: report.outreachScore.outreachProbabilityScore,
        outreachCompleted: true,
        lastOutreachDate: new Date(),
      },
    });

    for (const email of report.emails) {
      await outreachHistoryService.addEntry(leadId, {
        type: 'email',
        content: email.body,
        subject: email.subject,
        generatedAt: new Date(),
        status: 'pending',
      });
    }

    for (const msg of report.whatsappMessages) {
      await outreachHistoryService.addEntry(leadId, {
        type: 'whatsapp',
        content: msg.content,
        generatedAt: new Date(),
        status: 'pending',
      });
    }

    for (const proposal of report.proposals) {
      await outreachHistoryService.addEntry(leadId, {
        type: 'proposal',
        content: proposal.summary,
        subject: proposal.title,
        generatedAt: new Date(),
        status: 'pending',
      });
    }

    for (const followup of report.followupSequence) {
      await outreachHistoryService.addEntry(leadId, {
        type: 'followup',
        content: followup.content,
        subject: followup.subject,
        generatedAt: new Date(),
        status: 'pending',
        followUpStage: followup.stage,
      });
    }

    const updatedLead = await Lead.findById(leadId).lean();

    logger.info(`Outreach materials generated for lead ${leadId}: ${report.emails.length} emails, ${report.whatsappMessages.length} WhatsApp msgs, ${report.proposals.length} proposals`);

    return {
      success: true,
      data: updatedLead,
    };
  }

  async generateOutreachForMultipleLeads(leadIds: string[]) {
    const results = [];
    for (const leadId of leadIds) {
      try {
        await this.generateOutreachForLead(leadId);
        results.push({ leadId, success: true });
      } catch (error: any) {
        logger.error(error, `Failed to generate outreach for lead ${leadId}:`);
        results.push({ leadId, success: false, error: error.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: true,
      data: { results, successful, failed, total: leadIds.length },
    };
  }

  async generateOutreachForLeadsWithoutOutreach(limit = 50) {
    const leads = await Lead.find({
      $or: [
        { outreachCompleted: { $ne: true } },
        { outreachCompleted: { $exists: false } },
      ],
      website: { $exists: true, $nin: [null, ''] },
    })
      .limit(limit)
      .lean();

    if (leads.length === 0) {
      return {
        success: true,
        data: { results: [], successful: 0, failed: 0, total: 0, message: 'All leads already have outreach materials' },
      };
    }

    const leadIds = leads.map(l => l._id.toString());
    return this.generateOutreachForMultipleLeads(leadIds);
  }

  async getOutreachStats() {
    const total = await Lead.countDocuments();
    const outreachCompleted = await Lead.countDocuments({ outreachCompleted: true });
    const pendingOutreach = total - outreachCompleted;
    const highProbabilityLeads = await Lead.countDocuments({ outreachProbability: 'high', outreachCompleted: true });
    const readyForProposal = await Lead.countDocuments({ generatedProposals: { $exists: true, $not: { $size: 0 } } });
    const respondedLeads = await Lead.countDocuments({ 'outreachHistory.status': 'responded' });
    const interestedLeads = await Lead.countDocuments({ crmOutreachStatus: 'interested' });

    const highRedesignProspects = await Lead.countDocuments({
      outreachCompleted: true,
      generatedProposals: { $elemMatch: { type: 'website-redesign' } },
    });

    const highSEOProspects = await Lead.countDocuments({
      outreachCompleted: true,
      generatedProposals: { $elemMatch: { type: 'seo' } },
    });

    return {
      total,
      outreachCompleted,
      pendingOutreach,
      highProbabilityLeads,
      readyForProposal,
      respondedLeads,
      interestedLeads,
      highRedesignProspects,
      highSEOProspects,
    };
  }

  async getLeadOutreach(leadId: string) {
    const lead = await Lead.findById(leadId).lean();
    if (!lead) {
      throw new Error('Lead not found');
    }

    return {
      generatedEmails: lead.generatedEmails || [],
      generatedWhatsAppMessages: lead.generatedWhatsAppMessages || [],
      generatedProposals: lead.generatedProposals || [],
      followupSequence: lead.followupSequence || [],
      outreachHistory: lead.outreachHistory || [],
      outreachProbability: lead.outreachProbability || null,
      outreachProbabilityScore: lead.outreachProbabilityScore || null,
      crmOutreachStatus: lead.crmOutreachStatus || 'outreach_pending',
      outreachCompleted: lead.outreachCompleted || false,
      lastOutreachDate: lead.lastOutreachDate || null,
    };
  }

  async updateOutreachStatus(leadId: string, status: string) {
    const validStatuses = ['outreach_pending', 'email_sent', 'whatsapp_sent', 'followup_pending', 'proposal_sent', 'responded', 'interested', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    await Lead.findByIdAndUpdate(leadId, {
      $set: { crmOutreachStatus: status },
    });

    return { success: true, message: `Outreach status updated to ${status}` };
  }

  private toLeadInput(lead: Record<string, unknown>): LeadInput {
    return {
      companyName: lead.companyName as string || '',
      website: lead.website as string | undefined,
      category: lead.category as string | undefined,
      industry: lead.industry as string | undefined,
      address: lead.address as string | undefined,
      rating: lead.rating as number | undefined,
      reviewsCount: lead.reviewsCount as number | undefined,
      aiLeadScore: lead.aiLeadScore as number | undefined,
      trustScore: lead.trustScore as number | undefined,
      websiteQualityScore: lead.websiteQualityScore as number | undefined,
      socialPresenceScore: lead.socialPresenceScore as number | undefined,
      responsiveScore: lead.responsiveScore as number | undefined,
      uiuxScore: lead.uiuxScore as number | undefined,
      mobileExperienceScore: lead.mobileExperienceScore as number | undefined,
      seoOpportunity: lead.seoOpportunity as string | undefined,
      websiteRedesignPotential: lead.websiteRedesignPotential as string | undefined,
      digitalMarketingOpportunity: lead.digitalMarketingOpportunity as string | undefined,
      conversionProbability: lead.conversionProbability as string | undefined,
      revenuePotential: lead.revenuePotential as string | undefined,
      salesPriority: lead.salesPriority as string | undefined,
      aiSummary: lead.aiSummary as string | undefined,
      aiInsight: typeof lead.aiInsight === 'string'
        ? (() => { try { return JSON.parse(lead.aiInsight); } catch { return undefined; } })()
        : lead.aiInsight as { summary: string; strengths: string[]; weaknesses: string[]; recommendedAction: string; expectedOutcome: string } | undefined,
      businessOpportunity: lead.businessOpportunity as { level: string; score: number; reasons: string[]; recommendation: string } | undefined,
      aiRecommendation: lead.aiRecommendation as { summary: string; services: string[]; priority: string; keyIssues: string[] } | undefined,
      websiteFreshness: lead.websiteFreshness as { status: string; designGeneration: string; modernStandards: boolean } | undefined,
      footerAudit: lead.footerAudit as { copyrightDetected: boolean; copyrightYear: number | null; privacyPolicy: boolean; termsPage: boolean } | undefined,
      socialAudit: lead.socialAudit as { socialPresenceScore: number; facebook: boolean; instagram: boolean; linkedin: boolean } | undefined,
      contactAudit: lead.contactAudit as { phoneDetected: boolean; emailDetected: boolean; contactForm: boolean; contactMethods: number } | undefined,
      responsiveAudit: lead.responsiveAudit as { mobileFriendly: boolean; responsiveLayout: boolean; viewportMeta: boolean; touchFriendly: boolean } | undefined,
    };
  }
}

export const outreachService = new OutreachService();
