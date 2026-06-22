import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { ILead } from '../models/Lead';

interface AIAnalysisRequest {
  companyName: string;
  website?: string;
  category?: string;
  websiteStatus?: string;
  sslEnabled?: boolean;
  responseTime?: number;
  metaTitle?: string;
  metaDescription?: string;
  hasContactPage?: boolean;
  hasSocialLinks?: boolean;
  rating?: number;
  reviewsCount?: number;
  leadScore?: number;
}

interface AIAnalysisResponse {
  leadScore: number;
  qualificationLevel: string;
  websiteWeaknesses: string[];
  businessOpportunities: string[];
  summary: string;
  analysisTimestamp: string;
}

interface AIBulkAnalysisRequest {
  leads: AIAnalysisRequest[];
  batchSize?: number;
}

interface AIBulkAnalysisResponse {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: AIAnalysisResponse[];
}

export class AIClient {
  private client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.timeout = parseInt(process.env.AI_SERVICE_TIMEOUT || '30000', 10);
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`AI Service: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(error, 'AI Service: Request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug(`AI Service: Response status ${response.status}`);
        return response;
      },
      (error: AxiosError) => {
        logger.error(error, 'AI Service: Response error');
        return Promise.reject(error);
      }
    );
  }

  async analyzeLead(leadData: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const response = await this.client.post<AIAnalysisResponse>('/api/v1/analyze-lead', leadData);
      return response.data;
    } catch (error: any) {
      logger.error('AI Service: Lead analysis failed', error);
      throw new Error(`AI Analysis failed: ${error.message}`);
    }
  }

  async analyzeBulkLeads(leads: AIAnalysisRequest[], batchSize: number = 10): Promise<AIBulkAnalysisResponse> {
    try {
      const request: AIBulkAnalysisRequest = {
        leads,
        batchSize,
      };
      
      const response = await this.client.post<AIBulkAnalysisResponse>('/api/v1/bulk-analyze', request);
      return response.data;
    } catch (error: any) {
      logger.error('AI Service: Bulk analysis failed', error);
      throw new Error(`Bulk AI Analysis failed: ${error.message}`);
    }
  }

  async analyzeScoreOnly(leadData: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const response = await this.client.post<AIAnalysisResponse>('/api/v1/score-only', leadData);
      return response.data;
    } catch (error: any) {
      logger.error('AI Service: Score-only analysis failed', error);
      throw new Error(`AI Score analysis failed: ${error.message}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.get('/api/v1/health');
      return true;
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), 'AI Service: Health check failed');
      return false;
    }
  }
}

export class AILeadAnalysisService {
  private client: AIClient;

  constructor() {
    this.client = new AIClient();
  }

  /**
   * Analyze a single lead using AI service
   */
  async analyzeLead(lead: ILead): Promise<ILead> {
    const leadData: AIAnalysisRequest = {
      companyName: lead.companyName,
      website: lead.website,
      category: lead.category,
      websiteStatus: lead.websiteStatus,
      sslEnabled: lead.sslEnabled,
      responseTime: lead.responseTime,
      metaTitle: lead.metaTitle,
      metaDescription: lead.metaDescription,
      hasContactPage: lead.hasContactPage,
      hasSocialLinks: !!lead.hasSocialLinks,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      leadScore: lead.leadScore,
    };

    const aiResult = await this.client.analyzeLead(leadData);

    // Update lead with AI analysis results
    lead.leadScore = aiResult.leadScore;
    lead.qualificationLevel = aiResult.qualificationLevel as any;
    
    // Convert AI results to Lead model format
    lead.websiteStatus = this.mapAIWebsiteStatus(aiResult.qualificationLevel);
    lead.analyzedAt = new Date(aiResult.analysisTimestamp);
    
    // Store AI analysis details in hasSocialLinks structure
    (lead.hasSocialLinks as any).aiSummary = aiResult.summary;
    (lead.hasSocialLinks as any).aiWeaknesses = aiResult.websiteWeaknesses;
    (lead.hasSocialLinks as any).aiOpportunities = aiResult.businessOpportunities;

    return lead;
  }

  /**
   * Bulk analyze multiple leads
   */
  async analyzeBulkLeads(leads: ILead[], batchSize: number = 10): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    leads: ILead[];
  }> {
    const leadDataArray: AIAnalysisRequest[] = leads.map(lead => ({
      companyName: lead.companyName,
      website: lead.website,
      category: lead.category,
      websiteStatus: lead.websiteStatus,
      sslEnabled: lead.sslEnabled,
      responseTime: lead.responseTime,
      metaTitle: lead.metaTitle,
      metaDescription: lead.metaDescription,
      hasContactPage: lead.hasContactPage,
      hasSocialLinks: !!lead.hasSocialLinks,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      leadScore: lead.leadScore,
    }));

    const aiResult = await this.client.analyzeBulkLeads(leadDataArray, batchSize);

    // Update leads with AI results
    const updatedLeads: ILead[] = [];
    let failed = 0;

    for (let i = 0; i < aiResult.results.length; i++) {
      try {
        const lead = leads[i];
        const aiAnalysis = aiResult.results[i];
        
        lead.leadScore = aiAnalysis.leadScore;
        lead.qualificationLevel = aiAnalysis.qualificationLevel as any;
        lead.websiteStatus = this.mapAIWebsiteStatus(aiAnalysis.qualificationLevel);
        lead.analyzedAt = new Date(aiAnalysis.analysisTimestamp);
        
        (lead.hasSocialLinks as any).aiSummary = aiAnalysis.summary;
        (lead.hasSocialLinks as any).aiWeaknesses = aiAnalysis.websiteWeaknesses;
        (lead.hasSocialLinks as any).aiOpportunities = aiAnalysis.businessOpportunities;
        
        updatedLeads.push(lead);
      } catch (error) {
        failed++;
      }
    }

    return {
      totalProcessed: aiResult.totalProcessed,
      successful: aiResult.successful,
      failed: failed,
      leads: updatedLeads,
    };
  }

  /**
   * Check if AI service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    return this.client.checkHealth();
  }

  /**
   * Map AI qualification level to website status
   */
  private mapAIWebsiteStatus(qualification: string): ILead['websiteStatus'] {
    switch (qualification) {
      case 'high-potential':
        return 'modern-website';
      case 'medium-potential':
        return 'average-website';
      case 'low-potential':
        return 'outdated-website';
      default:
        return 'unknown';
    }
  }
}

export const aiLeadAnalysisService = new AILeadAnalysisService();
