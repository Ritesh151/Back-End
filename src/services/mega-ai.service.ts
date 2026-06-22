import { megaAIOrchestrator } from '../mega-ai-engine/mega-ai-orchestrator';

export class MegaAIService {
  async analyzeLead(leadId: string) {
    const result = await megaAIOrchestrator.runFullPipeline(leadId);
    return result;
  }

  async analyzeMultipleLeads(leadIds: string[]) {
    return megaAIOrchestrator.runFullPipelineForMultiple(leadIds);
  }

  async analyzePendingLeads(limit = 10) {
    return megaAIOrchestrator.runFullPipelineForPendingLeads(limit);
  }

  async getPipelineStats() {
    return megaAIOrchestrator.getPipelineStats();
  }
}

export const megaAIService = new MegaAIService();
