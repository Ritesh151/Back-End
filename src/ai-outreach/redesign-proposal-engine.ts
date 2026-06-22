import { LeadInput, GeneratedProposal } from './ai-outreach.types';
import { ProposalGenerator } from './proposal-generator';

export class RedesignProposalEngine extends ProposalGenerator {
  generateProposal(lead: LeadInput): GeneratedProposal {
    return this.generateWebsiteRedesignProposal(lead);
  }
}

export const redesignProposalEngine = new RedesignProposalEngine();
