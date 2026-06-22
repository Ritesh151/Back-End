import { Request, Response, NextFunction } from 'express';
import { crmService } from '../services/crm.service';
import { APIResponse } from '../utils/api-response';
import { PipelineStage } from '../crm/types';

export class CRMController {
  async getLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stage, page = '1', limit = '20' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      let leads; let pagination;
      if (stage && typeof stage === 'string') {
        const result = await crmService.getLeadsByStage(stage as PipelineStage, { page: pageNum, limit: limitNum });
        leads = result.leads; pagination = result.pagination;
      } else {
        const result = await crmService.getAllLeads({ page: pageNum, limit: limitNum });
        leads = result.leads; pagination = result.pagination;
      }
      APIResponse.success(res, { leads, pagination }, 'Leads fetched');
    } catch (error: any) { next(error); }
  }

  async updateStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const { stage } = req.body;
      const userId = (req as any).user?.id;
      if (!stage) { APIResponse.error(res, 'Stage is required', null, 400); return; }
      const result = await crmService.updateLeadStage(leadId, stage, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, result, result.message);
    } catch (error: any) { next(error); }
  }

  async updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const userId = (req as any).user?.id;
      const result = await crmService.updateLeadCRMFields(leadId, req.body, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, result, result.message);
    } catch (error: any) { next(error); }
  }

  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const { content } = req.body;
      const userId = (req as any).user?.id;
      if (!content) { APIResponse.error(res, 'Note content is required', null, 400); return; }
      const result = await crmService.addNote(leadId, content, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, result, result.message, 201);
    } catch (error: any) { next(error); }
  }

  async updateNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { noteId } = req.params;
      const { content } = req.body;
      const userId = (req as any).user?.id;
      if (!content) { APIResponse.error(res, 'Note content is required', null, 400); return; }
      const result = await crmService.updateNote(noteId, content, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, result, result.message);
    } catch (error: any) { next(error); }
  }

  async deleteNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { noteId } = req.params;
      const userId = (req as any).user?.id;
      const result = await crmService.deleteNote(noteId, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, null, result.message);
    } catch (error: any) { next(error); }
  }

  async getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const notes = await crmService.getNotes(leadId);
      APIResponse.success(res, notes, 'Notes fetched');
    } catch (error: any) { next(error); }
  }

  async createFollowUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const { dueDate, note } = req.body;
      const userId = (req as any).user?.id;
      if (!dueDate) { APIResponse.error(res, 'Due date is required', null, 400); return; }
      const result = await crmService.createFollowUp(leadId, new Date(dueDate), note, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, result, result.message, 201);
    } catch (error: any) { next(error); }
  }

  async updateFollowUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { followUpId } = req.params;
      const updates = req.body;
      const userId = (req as any).user?.id;
      const result = await crmService.updateFollowUp(followUpId, updates, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, result, result.message);
    } catch (error: any) { next(error); }
  }

  async deleteFollowUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { followUpId } = req.params;
      const userId = (req as any).user?.id;
      const result = await crmService.deleteFollowUp(followUpId, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, null, result.message);
    } catch (error: any) { next(error); }
  }

  async getFollowUps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const followUps = await crmService.getFollowUps(leadId);
      APIResponse.success(res, followUps, 'Follow-ups fetched');
    } catch (error: any) { next(error); }
  }

  async getActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const { type, limit } = req.query;
      const activities = await crmService.getActivities(leadId, {
        type: type as any, limit: parseInt(limit as string, 10),
      });
      APIResponse.success(res, activities, 'Activities fetched');
    } catch (error: any) { next(error); }
  }

  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await crmService.getCRMStats();
      APIResponse.success(res, stats, 'CRM stats fetched');
    } catch (error: any) { next(error); }
  }

  async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await crmService.getCRMAnalytics();
      APIResponse.success(res, analytics, 'CRM analytics fetched');
    } catch (error: any) { next(error); }
  }

  async getLeadDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const details = await crmService.getLeadDetails(leadId);
      if (!details) { APIResponse.error(res, 'Lead not found', null, 404); return; }
      APIResponse.success(res, details, 'Lead details fetched');
    } catch (error: any) { next(error); }
  }

  async getPipeline(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pipeline = await crmService.getPipeline();
      APIResponse.success(res, pipeline, 'Pipeline fetched');
    } catch (error: any) { next(error); }
  }

  async assignLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const { userId } = req.body;
      const assignedBy = (req as any).user?.id;
      const result = await crmService.assignLead(leadId, userId, assignedBy);
      if (!result.success) { APIResponse.error(res, result.message, null, 404); return; }
      APIResponse.success(res, result, result.message);
    } catch (error: any) { next(error); }
  }

  async moveLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { leadId } = req.params;
      const { fromStage, toStage } = req.body;
      const userId = (req as any).user?.id;
      const result = await crmService.moveLead(leadId, fromStage, toStage, userId);
      if (!result.success) { APIResponse.error(res, result.message, null, 400); return; }
      APIResponse.success(res, result, result.message);
    } catch (error: any) { next(error); }
  }
}

export const crmController = new CRMController();
