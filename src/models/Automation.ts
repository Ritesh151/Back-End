import { Schema, model, Document, Types } from 'mongoose';


export type AutomationFrequency = 'hourly' | 'daily' | 'weekly';
export type AutomationStatus = 'active' | 'paused' | 'failed';

export interface IAutomation extends Document {
  keyword: string;
  location: string;
  frequency: AutomationFrequency;
  limit: number;
  category?: string;
  status: AutomationStatus;
  lastRunAt?: Date;
  nextRunAt?: Date;
  totalRuns: number;
  lastRunLeads: number;
  lastRunStatus: 'success' | 'partial' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const automationSchema = new Schema<IAutomation>(
  {
    keyword: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    frequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      required: true,
    },
    limit: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    category: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'failed'],
      default: 'active',
    },
    lastRunAt: {
      type: Date,
    },
    nextRunAt: {
      type: Date,
    },
    totalRuns: {
      type: Number,
      default: 0,
    },
    lastRunLeads: {
      type: Number,
      default: 0,
    },
    lastRunStatus: {
      type: String,
      enum: ['success', 'partial', 'failed'],
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete (ret as any)._id;
        return ret;
      },
    },
  }
);

// Create indexes for common queries
automationSchema.index({ keyword: 1, location: 1 });
automationSchema.index({ frequency: 1 });
automationSchema.index({ status: 1 });
automationSchema.index({ nextRunAt: 1 });
automationSchema.index({ createdAt: -1 });

export const Automation = model<IAutomation>('Automation', automationSchema);

// Job Execution Model
export interface IJobExecution extends Document {
  automationId: Types.ObjectId;
  jobType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  totalLeadsGenerated: number;
  failedCount: number;
  logs: string[];
  error?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const jobExecutionSchema = new Schema<IJobExecution>(
  {
    automationId: {
      type: Schema.Types.ObjectId,
      ref: 'Automation',
      required: true,
    },
    jobType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    startedAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
    },
    totalLeadsGenerated: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    logs: [{
      type: String,
    }],
    error: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete (ret as any)._id;
        return ret;
      },
    },
  }
);

// Create indexes
jobExecutionSchema.index({ automationId: 1 });
jobExecutionSchema.index({ jobType: 1 });
jobExecutionSchema.index({ status: 1 });
jobExecutionSchema.index({ startedAt: -1 });

export const JobExecution = model<IJobExecution>('JobExecution', jobExecutionSchema);

// Automation Run History
export interface IAutomationHistory extends Document {
  automationId: Types.ObjectId;
  triggerType: 'scheduled' | 'manual' | 'api';
  totalLeadsGenerated: number;
  status: 'success' | 'partial' | 'failed';
  executionTime: number; // in seconds
  error?: string;
  metadata?: any;
  createdAt: Date;
}

const automationHistorySchema = new Schema<IAutomationHistory>(
  {
    automationId: {
      type: Schema.Types.ObjectId,
      ref: 'Automation',
      required: true,
    },
    triggerType: {
      type: String,
      enum: ['scheduled', 'manual', 'api'],
      required: true,
    },
    totalLeadsGenerated: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'partial', 'failed'],
      required: true,
    },
    executionTime: {
      type: Number,
      required: true,
    },
    error: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete (ret as any)._id;
        return ret;
      },
    },
  }
);

// Create indexes
automationHistorySchema.index({ automationId: 1 });
automationHistorySchema.index({ triggerType: 1 });
automationHistorySchema.index({ status: 1 });
automationHistorySchema.index({ createdAt: -1 });

export const AutomationHistory = model<IAutomationHistory>('AutomationHistory', automationHistorySchema);

// Export History
export interface IExportHistory extends Document {
  automationId: Types.ObjectId;
  exportType: 'csv' | 'excel';
  filePath: string;
  fileName: string;
  fileUrl?: string;
  generatedAt: Date;
  totalRecords: number;
  status: 'generated' | 'archived' | 'deleted';
  createdAt: Date;
}

const exportHistorySchema = new Schema<IExportHistory>(
  {
    automationId: {
      type: Schema.Types.ObjectId,
      ref: 'Automation',
      required: true,
    },
    exportType: {
      type: String,
      enum: ['csv', 'excel'],
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
    },
    generatedAt: {
      type: Date,
      required: true,
    },
    totalRecords: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['generated', 'archived', 'deleted'],
      default: 'generated',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete (ret as any)._id;
        return ret;
      },
    },
  }
);

// Create indexes
exportHistorySchema.index({ automationId: 1 });
exportHistorySchema.index({ exportType: 1 });
exportHistorySchema.index({ generatedAt: -1 });

export const ExportHistory = model<IExportHistory>('ExportHistory', exportHistorySchema);
