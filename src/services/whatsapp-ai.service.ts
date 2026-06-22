import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

interface StartCampaignResponse {
  sessionId: string;
  status: string;
  totalLeads: number;
  completed: number;
  failed: number;
  currentLead: string;
}

interface SessionStatusResponse {
  sessionId: string;
  status: string;
  totalLeads: number;
  completed: number;
  failed: number;
  currentLead: string | null;
  currentLeadIndex: number;
  currentStep: string;
  error: string | null;
  eta: number | null;
  elapsedSeconds: number;
  processed: number;
  remaining: number;
  leads: Array<{
    leadId: string;
    companyName: string;
    phone: string | null;
    website: string;
    city: string;
    messageType: string;
    queuePosition: number;
    status: string;
    error: string | null;
    attempts: number;
    durationMs: number;
    browserState: string;
    updatedAt: number;
    completedAt: number | null;
  }>;
  createdAt: number;
  completedAt: number | null;
}

export class WhatsAppAIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${AI_SERVICE_URL}/api/v1`,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use(
      (config) => {
        logger.info({ url: config.url, method: config.method }, '[WhatsAppAI] Request');
        return config;
      },
      (error) => {
        logger.error({ err: error.message }, '[WhatsAppAI] Request error');
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info({ url: response.config.url, status: response.status }, '[WhatsAppAI] Response');
        return response;
      },
      (error) => {
        logger.error({ err: error.message, url: error.config?.url }, '[WhatsAppAI] Response error');
        return Promise.reject(error);
      },
    );
  }

  async startCampaign(leadIds: string[]): Promise<StartCampaignResponse> {
    logger.info({ leadCount: leadIds.length }, '[WhatsAppAI] Starting campaign');
    try {
      const response = await this.client.post('/whatsapp/start-campaign', { leadIds });
      const data = response.data;
      
      logger.info(
        { sessionId: data.sessionId, status: data.status, totalLeads: data.totalLeads },
        '[WhatsAppAI] Campaign started'
      );
      
      return {
        sessionId: data.sessionId || '',
        status: data.status || 'created',
        totalLeads: data.totalLeads || 0,
        completed: data.completed || 0,
        failed: data.failed || 0,
        currentLead: data.currentLead || '',
      };
    } catch (error: any) {
      if (error.response?.status === 422) {
        const message = error.response?.data?.message || 'Validation failed';
        logger.warn({ status: 422, message }, '[WhatsAppAI] Validation error');
        const err = new Error(message) as any;
        err.statusCode = 422;
        err.code = error.response?.data?.code;
        throw err;
      }
      if (error.response?.status && error.response.status !== 500) {
        const message = error.response?.data?.message || 'Request failed';
        logger.warn({ status: error.response.status, message }, '[WhatsAppAI] API error');
        const err = new Error(message) as any;
        err.statusCode = error.response.status;
        err.code = error.response?.data?.code;
        throw err;
      }
      logger.error({ message: error.message, code: error.code }, '[WhatsAppAI] Campaign start failed');
      throw error;
    }
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    logger.info({ sessionId }, '[WhatsAppAI] Fetching session status');
    try {
      const response = await this.client.get<SessionStatusResponse>(`/whatsapp/sessions/${sessionId}/status`);
      const data = response.data;
      
      logger.info(
        { sessionId: data.sessionId, status: data.status, processed: data.processed, totalLeads: data.totalLeads },
        '[WhatsAppAI] Session status retrieved'
      );
      
      return {
        sessionId: data.sessionId || sessionId,
        status: data.status || 'unknown',
        totalLeads: data.totalLeads || 0,
        completed: data.completed || 0,
        failed: data.failed || 0,
        currentLead: data.currentLead || null,
        currentLeadIndex: data.currentLeadIndex || 0,
        currentStep: data.currentStep || '',
        error: data.error || null,
        eta: data.eta || null,
        elapsedSeconds: data.elapsedSeconds || 0,
        processed: data.processed || 0,
        remaining: data.remaining || 0,
        leads: data.leads || [],
        createdAt: data.createdAt || Date.now(),
        completedAt: data.completedAt || null,
      };
    } catch (error: any) {
      logger.error({ sessionId, message: error.message }, '[WhatsAppAI] Failed to get session status');
      throw error;
    }
  }

  async stopCampaign(sessionId: string): Promise<{ sessionId: string; status: string }> {
    logger.info({ sessionId }, '[WhatsAppAI] Stopping campaign');
    try {
      const response = await this.client.post(`/whatsapp/sessions/${sessionId}/stop`);
      const data = response.data;
      
      logger.info({ sessionId: data.sessionId, status: data.status }, '[WhatsAppAI] Campaign stopped');
      
      return {
        sessionId: data.sessionId || sessionId,
        status: data.status || 'stopped',
      };
    } catch (error: any) {
      logger.error({ sessionId, message: error.message }, '[WhatsAppAI] Failed to stop campaign');
      throw error;
    }
  }

  async generateMessages(leadIds: string[], campaignId: string = 'default'): Promise<Record<string, unknown>> {
    logger.info({ leadCount: leadIds.length, campaignId }, '[WhatsAppAI] Generating messages via Python');
    try {
      const response = await this.client.post('/whatsapp/generate', { leadIds, campaignId });
      const data = response.data;
      
      logger.info(
        { total: data.total, skippedCount: data.skippedCount, campaignId },
        '[WhatsAppAI] Messages generated'
      );
      
      return data;
    } catch (error: any) {
      logger.error({ campaignId, message: error.message }, '[WhatsAppAI] Failed to generate messages');
      throw error;
    }
  }
}

export const whatsAppAIService = new WhatsAppAIService();
