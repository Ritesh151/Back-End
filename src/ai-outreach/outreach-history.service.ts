import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';

export interface OutreachHistoryEntry {
  type: 'email' | 'whatsapp' | 'proposal' | 'followup';
  content: string;
  subject?: string;
  generatedAt: Date;
  status: 'pending' | 'sent' | 'opened' | 'responded';
  followUpStage?: number;
  response?: string;
}

export class OutreachHistoryService {
  async addEntry(leadId: string, entry: OutreachHistoryEntry): Promise<void> {
    try {
      await Lead.findByIdAndUpdate(leadId, {
        $push: { outreachHistory: entry },
        $set: {
          lastOutreachDate: new Date(),
          crmOutreachStatus: this.getCRMStatus(entry.type),
        },
      });
      logger.info(`Outreach history entry added for lead ${leadId}: ${entry.type}`);
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to add outreach history for lead ${leadId}:`);
    }
  }

  async updateStatus(leadId: string, entryId: string, status: OutreachHistoryEntry['status'], response?: string): Promise<void> {
    try {
      const update: Record<string, unknown> = {
        'outreachHistory.$.status': status,
      };
      if (response) {
        update['outreachHistory.$.response'] = response;
      }
      await Lead.findOneAndUpdate(
        { _id: leadId, 'outreachHistory._id': entryId },
        { $set: update }
      );
      logger.info(`Outreach status updated for lead ${leadId}: ${status}`);
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to update outreach status for lead ${leadId}:`);
    }
  }

  async getHistory(leadId: string): Promise<OutreachHistoryEntry[]> {
    try {
      const lead = await Lead.findById(leadId).lean();
      if (!lead || !lead.outreachHistory) return [];
      return lead.outreachHistory as OutreachHistoryEntry[];
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Failed to get outreach history for lead ${leadId}:`);
      return [];
    }
  }

  private getCRMStatus(type: OutreachHistoryEntry['type']): string {
    switch (type) {
      case 'email': return 'email_sent';
      case 'whatsapp': return 'whatsapp_sent';
      case 'proposal': return 'proposal_sent';
      case 'followup': return 'followup_pending';
      default: return 'outreach_pending';
    }
  }
}

export const outreachHistoryService = new OutreachHistoryService();
