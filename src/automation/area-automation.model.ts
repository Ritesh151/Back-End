import { Schema, model, Document, Model } from 'mongoose';
import type { AreaJobStatus, AreaSessionStatus, AreaAutomationSourceResult } from './area-automation.types';

export interface IAreaJobDocument extends Document {
  sessionId: string;
  businessType: string;
  state: string;
  city: string;
  area: string;
  sources: string[];
  status: AreaJobStatus;
  progress: string;
  totalLeads: number;
  sourceResults: AreaAutomationSourceResult[];
  startedAt: Date | null;
  completedAt: Date | null;
  failedReason: string | null;
  queuePosition: number;
  totalJobs: number;
}

export interface IAreaSessionDocument extends Document<string> {
  name: string;
  businessTypes: string[];
  state: string;
  cities: string[];
  sources: string[];
  status: AreaSessionStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  skippedJobs: number;
  totalLeads: number;
  startedAt: Date | null;
  completedAt: Date | null;
  pausedAt: Date | null;
  archivedAt: Date | null;
  retryCount: number;
  lastRunAt: Date | null;
  maxLeads: number;
  concurrency: number;
  retryEnabled: boolean;
  dedupEnabled: boolean;
  aiAuditEnabled: boolean;
  autoOutreach: boolean;
  autoReport: boolean;
  autoWhatsApp: boolean;
  schedule: string;
  frequency: string;
}

const sourceResultSchema = new Schema<AreaAutomationSourceResult>({
  source: { type: String, required: true },
  totalStored: { type: Number, default: 0 },
  totalExtracted: { type: Number, default: 0 },
  totalDuplicates: { type: Number, default: 0 },
  success: { type: Boolean, default: false },
}, { _id: false });

const areaJobSchema = new Schema<IAreaJobDocument>({
  sessionId: { type: String, required: true, index: true },
  businessType: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  area: { type: String, required: true },
  sources: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
    default: 'pending',
  },
  progress: { type: String, default: '' },
  totalLeads: { type: Number, default: 0 },
  sourceResults: [sourceResultSchema],
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  failedReason: { type: String, default: null },
  queuePosition: { type: Number, default: 0 },
  totalJobs: { type: Number, default: 0 },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id;
      delete (ret as Record<string, unknown>)._id;
      return ret;
    },
  },
});

areaJobSchema.index({ sessionId: 1, status: 1 });
areaJobSchema.index({ sessionId: 1, queuePosition: 1 });

const areaSessionSchema = new Schema<IAreaSessionDocument>({
  _id: { type: String },
  name: { type: String, default: '' },
  businessTypes: [{ type: String }],
  state: { type: String, required: true },
  cities: [{ type: String }],
  sources: [{ type: String }],
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed', 'failed', 'archived'],
    default: 'draft',
  },
  totalJobs: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  failedJobs: { type: Number, default: 0 },
  runningJobs: { type: Number, default: 0 },
  skippedJobs: { type: Number, default: 0 },
  totalLeads: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
  retryCount: { type: Number, default: 0 },
  lastRunAt: { type: Date, default: null },
  maxLeads: { type: Number, default: 100 },
  concurrency: { type: Number, default: 2 },
  retryEnabled: { type: Boolean, default: true },
  dedupEnabled: { type: Boolean, default: true },
  aiAuditEnabled: { type: Boolean, default: false },
  autoOutreach: { type: Boolean, default: false },
  autoReport: { type: Boolean, default: false },
  autoWhatsApp: { type: Boolean, default: false },
  schedule: { type: String, default: '' },
  frequency: { type: String, default: 'once' },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id;
      delete (ret as Record<string, unknown>)._id;
      return ret;
    },
  },
});

areaSessionSchema.index({ status: 1 });
areaSessionSchema.index({ createdAt: -1 });
areaSessionSchema.index({ name: 1 });
areaSessionSchema.index({ state: 1 });

export const AreaJobModel: Model<IAreaJobDocument> = model<IAreaJobDocument>('AreaAutomationJob', areaJobSchema);
export const AreaSessionModel: Model<IAreaSessionDocument> = model<IAreaSessionDocument>('AreaAutomationSession', areaSessionSchema);
