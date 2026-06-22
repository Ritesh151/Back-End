import { Request, Response, NextFunction } from 'express';
import { whatsAppTemplatesService } from '../services/whatsapp-templates.service';
import { logger } from '../utils/logger';

export class WhatsAppTemplateController {
  async getTemplates(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const templates = await whatsAppTemplatesService.getTemplates();
      res.status(200).json({ success: true, data: templates });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppTemplates] getTemplates error');
      res.status(500).json({ success: false, message: `Failed to fetch templates: ${errMsg}` });
    }
  }

  async updateWebsiteTemplate(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { message, name } = req.body as { message?: string; name?: string };

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Message is required and cannot be empty' });
        return;
      }

      const sanitized = whatsAppTemplatesService.sanitizeMessage(message);

      if (sanitized.length === 0) {
        res.status(400).json({ success: false, message: 'Message cannot be empty after trimming' });
        return;
      }

      await whatsAppTemplatesService.updateTemplate('website', sanitized, name);

      res.status(200).json({
        success: true,
        message: 'Website template saved successfully',
        data: { name: name || 'Website Template', message: sanitized },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppTemplates] updateWebsiteTemplate error');
      res.status(500).json({ success: false, message: `Failed to update website template: ${errMsg}` });
    }
  }

  async updateNoWebsiteTemplate(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { message, name } = req.body as { message?: string; name?: string };

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Message is required and cannot be empty' });
        return;
      }

      const sanitized = whatsAppTemplatesService.sanitizeMessage(message);

      if (sanitized.length === 0) {
        res.status(400).json({ success: false, message: 'Message cannot be empty after trimming' });
        return;
      }

      await whatsAppTemplatesService.updateTemplate('no_website', sanitized, name);

      res.status(200).json({
        success: true,
        message: 'No-Website template saved successfully',
        data: { name: name || 'No Website Template', message: sanitized },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppTemplates] updateNoWebsiteTemplate error');
      res.status(500).json({ success: false, message: `Failed to update no-website template: ${errMsg}` });
    }
  }

  async previewTemplate(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { type, message } = req.body as { type?: string; message?: string };

      if (!type || !['website', 'no_website'].includes(type)) {
        res.status(400).json({ success: false, message: 'type must be "website" or "no_website"' });
        return;
      }

      if (!message) {
        res.status(400).json({ success: false, message: 'message is required' });
        return;
      }

      const sampleLead = whatsAppTemplatesService.getSampleLeadData();
      const senderInfo = { name: '', phone: '', email: '', website: '' };
      const rendered = whatsAppTemplatesService.replacePlaceholders(message, sampleLead, senderInfo);

      res.status(200).json({ success: true, data: { rendered } });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppTemplates] previewTemplate error');
      res.status(500).json({ success: false, message: `Failed to preview template: ${errMsg}` });
    }
  }

  async resetTemplates(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      await whatsAppTemplatesService.resetToDefaults();
      const templates = await whatsAppTemplatesService.getTemplates();

      res.status(200).json({
        success: true,
        message: 'Templates reset to defaults successfully',
        data: templates,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: errMsg }, '[WhatsAppTemplates] resetTemplates error');
      res.status(500).json({ success: false, message: `Failed to reset templates: ${errMsg}` });
    }
  }
}

export const whatsAppTemplateController = new WhatsAppTemplateController();
