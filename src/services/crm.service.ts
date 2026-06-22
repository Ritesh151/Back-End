import { logger } from '../utils/logger';
import { Lead } from '../models/Lead';
import { Note } from '../crm/models/CrmNote';
import { FollowUp } from '../crm/models/CrmFollowUp';
import { Activity } from '../crm/models/CrmActivity';
import { PipelineStage, PIPELINE_STAGES, ActivityType, CRMStats, LeadDetails, CRMAnalytics, CRMUpdateFields } from '../crm/types';

export class CRMService {
  async getAllLeads(options?: { page?: number; limit?: number }): Promise<{
    leads: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const leads = await Lead.find({})
      .sort({ stageUpdatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await Lead.countDocuments({});
    return {
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLeadsByStage(stage: PipelineStage, options?: { page?: number; limit?: number }): Promise<{
    leads: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const leads = await Lead.find({ pipelineStage: stage })
      .sort({ stageUpdatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await Lead.countDocuments({ pipelineStage: stage });
    return {
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateLeadStage(
    leadId: string,
    newStage: PipelineStage,
    userId: string
  ): Promise<{ success: boolean; message: string; lead?: any; activity?: any }> {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      logger.warn(`CRMService: Lead not found: ${leadId}`);
      return { success: false, message: 'Lead not found' };
    }
    const oldStage = lead.pipelineStage;
    if (oldStage === newStage) {
      return { success: true, message: 'Lead is already in this stage' };
    }
    lead.pipelineStage = newStage;
    lead.stageUpdatedAt = new Date();
    lead.lastContactedAt = new Date();
    await lead.save();

    const activity = new Activity({
      leadId,
      type: 'stage-changed',
      previousValue: oldStage,
      updatedValue: newStage,
      description: `Moved from ${this.getStageLabel(oldStage)} to ${this.getStageLabel(newStage)}`,
      createdBy: userId,
    });
    await activity.save();

    lead.activityHistory = lead.activityHistory || [];
    lead.activityHistory.push({
      type: 'stage-changed',
      timestamp: new Date(),
      details: `Moved from ${this.getStageLabel(oldStage)} to ${this.getStageLabel(newStage)}`,
    });
    await lead.save();

    logger.info(`CRMService: Lead ${leadId} moved from ${oldStage} to ${newStage}`);
    return {
      success: true,
      message: 'Stage updated successfully',
      lead: lead.toObject(),
      activity: activity.toObject(),
    };
  }

  async updateLeadCRMFields(
    leadId: string,
    fields: CRMUpdateFields,
    userId: string
  ): Promise<{ success: boolean; message: string; lead?: any }> {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, message: 'Lead not found' };
    }
    if (fields.contactStatus !== undefined) lead.contactStatus = fields.contactStatus as any;
    if (fields.interestStatus !== undefined) lead.interestStatus = fields.interestStatus as any;
    if (fields.followUpDate !== undefined) lead.followUpDate = new Date(fields.followUpDate);
    if (fields.followUpNotes !== undefined) lead.followUpNotes = fields.followUpNotes;
    if (fields.salesNotes !== undefined) lead.salesNotes = fields.salesNotes;
    if (fields.discussionSummary !== undefined) lead.discussionSummary = fields.discussionSummary;
    if (fields.clientBudget !== undefined) lead.clientBudget = fields.clientBudget;
    if (fields.requiredServices !== undefined) lead.requiredServices = fields.requiredServices;
    if (fields.priorityLevel !== undefined) lead.priorityLevel = fields.priorityLevel as any;
    if (fields.proposalStatus !== undefined) lead.proposalStatus = fields.proposalStatus as any;
    if (fields.meetingStatus !== undefined) lead.meetingStatus = fields.meetingStatus as any;
    if (fields.assignedTo !== undefined) lead.assignedTo = fields.assignedTo;
    if (fields.dealValue !== undefined) lead.dealValue = fields.dealValue;
    if (fields.expectedClosingDate !== undefined) lead.expectedClosingDate = new Date(fields.expectedClosingDate);
    if (fields.whatsappNumber !== undefined) lead.whatsappNumber = fields.whatsappNumber;
    if (fields.tags !== undefined) lead.tags = fields.tags;

    // Auto-derive pipelineStage from changed fields
    let stageChanged = false;
    let newStage = lead.pipelineStage;

    if (fields.interestStatus !== undefined) {
      const stageMap: Record<string, PipelineStage> = {
        'interested': 'interested',
        'not-interested': 'not-interested',
        'maybe-later': 'follow-up',
      };
      if (stageMap[fields.interestStatus]) {
        newStage = stageMap[fields.interestStatus];
        stageChanged = true;
      }
    }

    if (!stageChanged && fields.contactStatus !== undefined) {
      if (fields.contactStatus === 'contacted') {
        newStage = 'contacted';
        stageChanged = true;
      }
    }

    if (!stageChanged && fields.followUpDate !== undefined && fields.followUpDate) {
      newStage = 'follow-up';
      stageChanged = true;
    }

    if (fields.proposalStatus !== undefined) {
      const stageMap: Record<string, PipelineStage> = {
        'pending': 'proposal-sent',
        'sent': 'proposal-sent',
        'approved': 'negotiation',
        'rejected': 'deal-lost',
      };
      if (stageMap[fields.proposalStatus]) {
        newStage = stageMap[fields.proposalStatus];
        stageChanged = true;
      }
    }

    if (fields.meetingStatus !== undefined) {
      if (fields.meetingStatus === 'scheduled') {
        newStage = 'meeting-scheduled';
        stageChanged = true;
      }
    }

    if (stageChanged && newStage !== lead.pipelineStage) {
      logger.info(`CRMService: Auto-deriving stage for lead ${leadId}: ${lead.pipelineStage} -> ${newStage}`);
      lead.pipelineStage = newStage;
      lead.stageUpdatedAt = new Date();
    }

    await lead.save();

    const activity = new Activity({
      leadId,
      type: 'lead-converted',
      updatedValue: 'CRM fields updated',
      description: 'Lead CRM details updated',
      createdBy: userId,
    });
    await activity.save();

    return { success: true, message: 'CRM fields updated', lead: lead.toObject() };
  }

  async addNote(
    leadId: string,
    content: string,
    userId: string
  ): Promise<{ success: boolean; message: string; note?: any }> {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, message: 'Lead not found' };
    }
    const note = new Note({ leadId, content, author: userId });
    await note.save();

    const activity = new Activity({
      leadId, type: 'note-added',
      updatedValue: content.substring(0, 100),
      description: 'New note added',
      createdBy: userId,
    });
    await activity.save();

    lead.activityHistory = lead.activityHistory || [];
    lead.activityHistory.push({
      type: 'note-added', timestamp: new Date(),
      details: `Note: ${content.substring(0, 100)}...`,
    });
    await lead.save();

    return { success: true, message: 'Note added', note };
  }

  async updateNote(noteId: string, content: string, userId: string): Promise<{
    success: boolean; message: string; note?: any;
  }> {
    const note = await Note.findById(noteId);
    if (!note) return { success: false, message: 'Note not found' };
    note.content = content;
    await note.save();

    const activity = new Activity({
      leadId: note.leadId, type: 'note-updated',
      previousValue: note.content, updatedValue: content.substring(0, 100),
      description: 'Note updated', createdBy: userId,
    });
    await activity.save();
    return { success: true, message: 'Note updated', note };
  }

  async deleteNote(noteId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const note = await Note.findById(noteId);
    if (!note) return { success: false, message: 'Note not found' };
    const leadId = note.leadId;
    await note.deleteOne();
    const activity = new Activity({
      leadId, type: 'note-deleted',
      previousValue: note.content, description: 'Note deleted', createdBy: userId,
    });
    await activity.save();
    return { success: true, message: 'Note deleted' };
  }

  async getNotes(leadId: string): Promise<any[]> {
    return await Note.find({ leadId }).sort({ createdAt: -1 }).lean();
  }

  async createFollowUp(
    leadId: string, dueDate: Date, note?: string, userId?: string
  ): Promise<{ success: boolean; message: string; followUp?: any }> {
    const lead = await Lead.findById(leadId);
    if (!lead) return { success: false, message: 'Lead not found' };
    const followUp = new FollowUp({ leadId, dueDate, note, completed: false });
    await followUp.save();
    lead.followUpDate = dueDate;
    await lead.save();

    const activity = new Activity({
      leadId, type: 'follow-up-created',
      updatedValue: dueDate.toISOString(),
      description: `Follow-up scheduled for ${dueDate.toLocaleDateString()}`,
      createdBy: userId || 'system',
    });
    await activity.save();
    return { success: true, message: 'Follow-up created', followUp };
  }

  async updateFollowUp(
    followUpId: string, updates: { dueDate?: Date; note?: string; completed?: boolean }, userId: string
  ): Promise<{ success: boolean; message: string; followUp?: any }> {
    const followUp = await FollowUp.findById(followUpId);
    if (!followUp) return { success: false, message: 'Follow-up not found' };
    const oldCompleted = followUp.completed;
    if (updates.dueDate) followUp.dueDate = updates.dueDate;
    if (updates.note !== undefined) followUp.note = updates.note;
    if (updates.completed !== undefined) {
      followUp.completed = updates.completed;
      if (updates.completed && !oldCompleted) followUp.completedAt = new Date();
    }
    await followUp.save();

    const lead = await Lead.findById(followUp.leadId);
    if (lead) {
      lead.followUpDate = followUp.completed ? undefined : followUp.dueDate;
      await lead.save();
    }

    const activityType = updates.completed
      ? oldCompleted ? 'follow-up-updated' : 'follow-up-completed'
      : 'follow-up-updated';
    const activity = new Activity({
      leadId: followUp.leadId, type: activityType as ActivityType,
      updatedValue: followUp.dueDate.toISOString(),
      description: updates.completed ? 'Follow-up completed' : 'Follow-up updated',
      createdBy: userId,
    });
    await activity.save();
    return { success: true, message: 'Follow-up updated', followUp };
  }

  async deleteFollowUp(followUpId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const followUp = await FollowUp.findById(followUpId);
    if (!followUp) return { success: false, message: 'Follow-up not found' };
    const leadId = followUp.leadId;
    await followUp.deleteOne();
    const lead = await Lead.findById(leadId);
    if (lead) { lead.followUpDate = undefined; await lead.save(); }
    const activity = new Activity({
      leadId, type: 'follow-up-deleted', description: 'Follow-up deleted', createdBy: userId,
    });
    await activity.save();
    return { success: true, message: 'Follow-up deleted' };
  }

  async getFollowUps(leadId: string): Promise<any[]> {
    return await FollowUp.find({ leadId }).sort({ dueDate: 1 }).lean();
  }

  async getActivities(leadId: string, options?: { limit?: number; type?: ActivityType }): Promise<any[]> {
    const query: any = { leadId };
    if (options?.type) query.type = options.type;
    return await Activity.find(query).sort({ timestamp: -1 }).limit(options?.limit || 50).lean();
  }

  async getPipeline(): Promise<{
    stages: { id: PipelineStage; label: string; order: number; leads: any[] }[];
  }> {
    const stages = await Promise.all(
      PIPELINE_STAGES.map(async (stage) => {
        const leads = await Lead.find({ pipelineStage: stage.id })
          .sort({ stageUpdatedAt: -1, createdAt: -1 })
          .limit(50)
          .lean();
        return {
          id: stage.id,
          label: stage.label,
          order: stage.order,
          leads: leads.map((l) => ({ ...l, id: l._id.toString() })),
        };
      })
    );
    return { stages };
  }

  async getCRMStats(): Promise<CRMStats> {
    const totalLeads = await Lead.countDocuments();
    const pipelineStats = await Lead.aggregate([
      { $group: { _id: '$pipelineStage', count: { $sum: 1 } } },
    ]);
    const leadsByStage: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) leadsByStage[stage.id] = 0;
    for (const stat of pipelineStats) leadsByStage[stat._id as string] = stat.count;

    const wonCount = leadsByStage['deal-won'] || 0;
    const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
    const overdueFollowUps = await FollowUp.countDocuments({ completed: false, dueDate: { $lt: new Date() } });
    const totalContacted = await Lead.countDocuments({ pipelineStage: 'contacted' });
    const totalInterested = await Lead.countDocuments({ pipelineStage: 'interested' });
    const totalDealsWon = wonCount;
    const revenueResult = await Lead.aggregate([
      { $match: { pipelineStage: 'deal-won', dealValue: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$dealValue' } } },
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    return {
      totalLeads,
      leadsByStage: leadsByStage as Record<PipelineStage, number>,
      conversionRate,
      followUpReminders: 0,
      overdueFollowUps,
      pipelineVelocity: 0,
      totalContacted,
      totalInterested,
      totalDealsWon,
      totalRevenue,
    };
  }

  async getCRMAnalytics(): Promise<CRMAnalytics> {
    const allLeads = await Lead.find({}).lean();
    const totalLeads = allLeads.length;
    const leadsByStage: Record<string, number> = {};
    const revenueByStage: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) {
      leadsByStage[stage.id] = 0;
      revenueByStage[stage.id] = 0;
    }
    for (const lead of allLeads) {
      const stage = lead.pipelineStage || 'new-lead';
      leadsByStage[stage] = (leadsByStage[stage] || 0) + 1;
      if (lead.dealValue) {
        revenueByStage[stage] = (revenueByStage[stage] || 0) + lead.dealValue;
      }
    }

    const totalDealsWon = leadsByStage['deal-won'] || 0;
    const conversionRate = totalLeads > 0 ? (totalDealsWon / totalLeads) * 100 : 0;
    const totalRevenue = revenueByStage['deal-won'] || 0;
    const avgDealValue = totalDealsWon > 0 ? totalRevenue / totalDealsWon : 0;
    const followUpsOverdue = await FollowUp.countDocuments({ completed: false, dueDate: { $lt: new Date() } });
    const followUpsPending = await FollowUp.countDocuments({ completed: false });

    return {
      totalLeads,
      totalContacted: leadsByStage['contacted'] || 0,
      totalInterested: leadsByStage['interested'] || 0,
      totalNotInterested: leadsByStage['not-interested'] || 0,
      totalFollowUps: leadsByStage['follow-up'] || 0,
      totalMeetingsScheduled: leadsByStage['meeting-scheduled'] || 0,
      totalProposalsSent: leadsByStage['proposal-sent'] || 0,
      totalNegotiations: leadsByStage['negotiation'] || 0,
      totalDealsWon,
      totalDealsLost: leadsByStage['deal-lost'] || 0,
      conversionRate,
      totalRevenue,
      avgDealValue,
      followUpsPending,
      followUpsOverdue,
      leadsByStage: leadsByStage as Record<PipelineStage, number>,
      revenueByStage: revenueByStage as Record<PipelineStage, number>,
    };
  }

  async getLeadDetails(leadId: string): Promise<LeadDetails | null> {
    const lead = await Lead.findById(leadId).lean();
    if (!lead) return null;
    const notesCount = await Note.countDocuments({ leadId });
    const lastNote = await Note.findOne({ leadId }).sort({ createdAt: -1 }).lean();
    const activityCount = await Activity.countDocuments({ leadId });

    return {
      id: lead._id.toString(),
      companyName: lead.companyName,
      website: lead.website,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      category: lead.category,
      source: lead.source,
      stage: lead.pipelineStage,
      leadScore: lead.leadScore,
      lastContactedAt: lead.lastContactedAt,
      followUpDate: lead.followUpDate,
      followUpNotes: lead.followUpNotes,
      hasFollowUp: !!lead.followUpDate,
      assignedTo: lead.assignedTo?.toString(),
      notesCount,
      lastNote: lastNote?.content,
      lastNoteDate: lastNote?.createdAt,
      activityCount,
      contactStatus: lead.contactStatus,
      interestStatus: lead.interestStatus,
      salesNotes: lead.salesNotes,
      discussionSummary: lead.discussionSummary,
      clientBudget: lead.clientBudget,
      requiredServices: lead.requiredServices,
      priorityLevel: lead.priorityLevel,
      proposalStatus: lead.proposalStatus,
      meetingStatus: lead.meetingStatus,
      dealValue: lead.dealValue,
      expectedClosingDate: lead.expectedClosingDate,
      whatsappNumber: lead.whatsappNumber,
      tags: lead.tags,
      stageUpdatedAt: lead.stageUpdatedAt,
    };
  }

  async assignLead(leadId: string, userId: string, assignedBy: string): Promise<{
    success: boolean; message: string; lead?: any;
  }> {
    const lead = await Lead.findById(leadId);
    if (!lead) return { success: false, message: 'Lead not found' };
    lead.assignedTo = userId;
    await lead.save();
    const activity = new Activity({
      leadId, type: 'lead-assigned',
      updatedValue: userId, description: 'Lead assigned', createdBy: assignedBy,
    });
    await activity.save();
    return { success: true, message: 'Lead assigned', lead: lead.toObject() };
  }

  async moveLead(
    leadId: string, fromStage: PipelineStage, toStage: PipelineStage, userId: string
  ): Promise<{ success: boolean; message: string; lead?: any }> {
    const fromStageObj = PIPELINE_STAGES.find((s) => s.id === fromStage);
    const toStageObj = PIPELINE_STAGES.find((s) => s.id === toStage);
    if (!fromStageObj || !toStageObj) return { success: false, message: 'Invalid stage' };
    return this.updateLeadStage(leadId, toStage, userId);
  }

  private getStageLabel(stage: PipelineStage): string {
    const stageObj = PIPELINE_STAGES.find((s) => s.id === stage);
    return stageObj?.label || stage;
  }
}

export const crmService = new CRMService();
