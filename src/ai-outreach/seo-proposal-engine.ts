import { LeadInput, GeneratedProposal } from './ai-outreach.types';
import { ProposalGenerator } from './proposal-generator';

export class SEOProposalEngine extends ProposalGenerator {
  generateProposal(lead: LeadInput): GeneratedProposal {
    return this.generateSEOProposal(lead);
  }
}

export const seoProposalEngine = new SEOProposalEngine();
