import { Schema, model, Model, Document } from 'mongoose';
import type { LogStatus, MonitorLogEntry } from './monitor.types';

export interface IExecutionLogDocument extends Document {
  sessionId: string;
  jobId: string;
  state: string;
  city: string;
  area: string;
  businessType: string;
  sources: string[];
  status: LogStatus;
  totalLeads: number;
  sourceResults: Array<{
    source: string;
    totalStored: number;
    totalExtracted: number;
    success: boolean;
  }>;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  error: string | null;
  workerId: string;
  logs: MonitorLogEntry[];
}

const logEntrySchema = new Schema<MonitorLogEntry>({
  timestamp: { type: String, required: true },
  message: { type: String, required: true },
  level: { type: String, enum: ['info', 'warn', 'error', 'success'], required: true },
}, { _id: false });

const executionLogSchema = new Schema<IExecutionLogDocument>({
  sessionId: { type: String, required: true, index: true },
  jobId: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  area: { type: String, required: true },
  businessType: { type: String, required: true },
  sources: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  },
  totalLeads: { type: Number, default: 0 },
  sourceResults: [{
    _id: false,
    source: { type: String },
    totalStored: { type: Number },
    totalExtracted: { type: Number },
    success: { type: Boolean },
  }],
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  duration: { type: Number, default: null },
  error: { type: String, default: null },
  workerId: { type: String, required: true },
  logs: [logEntrySchema],
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_, ret) => {
      (ret as Record<string, unknown>).id = (ret as Record<string, unknown>)._id;
      delete (ret as Record<string, unknown>)._id;
      return ret;
    },
  },
});

executionLogSchema.index({ sessionId: 1, status: 1 });
executionLogSchema.index({ sessionId: 1, city: 1, area: 1 });

export const ExecutionLogModel: Model<IExecutionLogDocument> = model<IExecutionLogDocument>('AutomationExecutionLog', executionLogSchema);
