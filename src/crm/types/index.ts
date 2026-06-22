export type PipelineStage = 
  | 'new-lead'
  | 'contacted'
  | 'interested'
  | 'not-interested'
  | 'follow-up'
  | 'meeting-scheduled'
  | 'proposal-sent'
  | 'negotiation'
  | 'deal-won'
  | 'deal-lost';

export const PIPELINE_STAGES: { id: PipelineStage; label: string; order: number }[] = [
  { id: 'new-lead', label: 'New Lead', order: 1 },
  { id: 'contacted', label: 'Contacted', order: 2 },
  { id: 'interested', label: 'Interested', order: 3 },
  { id: 'not-interested', label: 'Not Interested', order: 4 },
  { id: 'follow-up', label: 'Follow Up', order: 5 },
  { id: 'meeting-scheduled', label: 'Meeting Scheduled', order: 6 },
  { id: 'proposal-sent', label: 'Proposal Sent', order: 7 },
  { id: 'negotiation', label: 'Negotiation', order: 8 },
  { id: 'deal-won', label: 'Deal Won', order: 9 },
  { id: 'deal-lost', label: 'Deal Lost', order: 10 },
];

export type ActivityType = 
  | 'lead-created'
  | 'stage-changed'
  | 'note-added'
  | 'note-updated'
  | 'note-deleted'
  | 'follow-up-created'
  | 'follow-up-updated'
  | 'follow-up-deleted'
  | 'follow-up-completed'
  | 'lead-assigned'
  | 'lead-converted';

export interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;
  timestamp: Date;
  previousValue?: string;
  updatedValue?: string;
  description: string;
  createdBy: string;
}

export interface Note {
  id: string;
  leadId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: string;
}

export interface FollowUp {
  id: string;
  leadId: string;
  dueDate: Date;
  note?: string;
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadPipelineUpdate {
  leadId: string;
  stage: PipelineStage;
  userId?: string;
}

export interface LeadAssignment {
  leadId: string;
  userId: string;
}

export interface ActivityFilter {
  leadId?: string;
  type?: ActivityType;
  startDate?: Date;
  endDate?: Date;
}

export interface CRMStats {
  totalLeads: number;
  leadsByStage: Record<PipelineStage, number>;
  conversionRate: number;
  followUpReminders: number;
  overdueFollowUps: number;
  pipelineVelocity: number;
  totalContacted: number;
  totalInterested: number;
  totalDealsWon: number;
  totalRevenue: number;
}

export interface PipelineMove {
  leadId: string;
  fromStage: PipelineStage;
  toStage: PipelineStage;
  timestamp: Date;
  movedBy: string;
}

export interface LeadDetails {
  id: string;
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  source?: string;
  stage: PipelineStage;
  leadScore: number;
  lastContactedAt?: Date;
  followUpDate?: Date;
  followUpNotes?: string;
  hasFollowUp: boolean;
  assignedTo?: string;
  assignedToName?: string;
  notesCount: number;
  lastNote?: string;
  lastNoteDate?: Date;
  activityCount: number;
  contactStatus?: string;
  interestStatus?: string;
  salesNotes?: string;
  discussionSummary?: string;
  clientBudget?: number;
  requiredServices?: string[];
  priorityLevel?: string;
  proposalStatus?: string;
  meetingStatus?: string;
  dealValue?: number;
  expectedClosingDate?: Date;
  whatsappNumber?: string;
  tags?: string[];
  stageUpdatedAt?: Date;
}

export interface CRMAnalytics {
  totalLeads: number;
  totalContacted: number;
  totalInterested: number;
  totalNotInterested: number;
  totalFollowUps: number;
  totalMeetingsScheduled: number;
  totalProposalsSent: number;
  totalNegotiations: number;
  totalDealsWon: number;
  totalDealsLost: number;
  conversionRate: number;
  totalRevenue: number;
  avgDealValue: number;
  followUpsPending: number;
  followUpsOverdue: number;
  leadsByStage: Record<PipelineStage, number>;
  revenueByStage: Record<PipelineStage, number>;
}

export interface CRMUpdateFields {
  contactStatus?: string;
  interestStatus?: string;
  followUpDate?: string;
  followUpNotes?: string;
  salesNotes?: string;
  discussionSummary?: string;
  clientBudget?: number;
  requiredServices?: string[];
  priorityLevel?: string;
  proposalStatus?: string;
  meetingStatus?: string;
  assignedTo?: string;
  dealValue?: number;
  expectedClosingDate?: string;
  whatsappNumber?: string;
  tags?: string[];
}
