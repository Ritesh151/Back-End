import { LeadInput, OutreachReport } from './ai-outreach.types';
import { ColdEmailEngine } from './cold-email-engine';
import { WhatsAppMessageEngine } from './whatsapp-message-engine';
import { ProposalGenerator } from './proposal-generator';
import { FollowupSequenceEngine } from './followup-sequence-engine';
import { OutreachScoreEngine } from './outreach-score-engine';
import { AIPitchGenerator } from './ai-pitch-generator';

export class OutreachReportGenerator {
  private coldEmailEngine: ColdEmailEngine;
  private whatsappEngine: WhatsAppMessageEngine;
  private proposalGen: ProposalGenerator;
  private followupEngine: FollowupSequenceEngine;
  private scoreEngine: OutreachScoreEngine;
  private pitchGenerator: AIPitchGenerator;

  constructor(
    engine?: ColdEmailEngine,
    whatsappEngine?: WhatsAppMessageEngine,
    proposalGen?: ProposalGenerator,
    followupEngine?: FollowupSequenceEngine,
    scoreEngine?: OutreachScoreEngine,
    pitchGenerator?: AIPitchGenerator,
  ) {
    this.coldEmailEngine = engine || new ColdEmailEngine();
    this.whatsappEngine = whatsappEngine || new WhatsAppMessageEngine();
    this.proposalGen = proposalGen || new ProposalGenerator();
    this.followupEngine = followupEngine || new FollowupSequenceEngine();
    this.scoreEngine = scoreEngine || new OutreachScoreEngine();
    this.pitchGenerator = pitchGenerator || new AIPitchGenerator();
  }

  generateFullReport(leadId: string, lead: LeadInput): OutreachReport {
    const emails = this.coldEmailEngine.generateAll(lead, []);
    const whatsappMessages = this.whatsappEngine.generateAll(lead, []);
    const proposals = this.proposalGen.generateAll(lead, []);
    const followupSequence = this.followupEngine.generateSequence(lead);
    const outreachScore = this.scoreEngine.calculate(lead);

    return {
      leadId,
      companyName: lead.companyName,
      emails,
      whatsappMessages,
      proposals,
      followupSequence,
      outreachScore,
      generatedAt: new Date().toISOString(),
    };
  }

  generatePitchSummary(lead: LeadInput): string {
    return this.pitchGenerator.generateSalesPitch(lead);
  }

  generateQuickPitch(lead: LeadInput): string {
    return this.pitchGenerator.generateQuickPitch(lead);
  }
}

export const outreachReportGenerator = new OutreachReportGenerator();
