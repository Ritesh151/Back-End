import { Schema, model, Document } from 'mongoose';

export interface ISearchHistory extends Document {
  searchSessionId: string;
  keyword: string;
  state?: string;
  city?: string;
  area?: string;
  sources: string[];
  totalLeads: number;
  startedAt: Date;
  completedAt?: Date;
  duration: number;
  status: 'running' | 'completed' | 'failed';
  currentFound: number;
  currentSaved: number;
  currentDuplicates: number;
  failedCount: number;
  estimatedTotal: number;
  progress: number;
  currentSource: string;
  isRunning: boolean;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const searchHistorySchema = new Schema<ISearchHistory>(
  {
    searchSessionId: { type: String, required: true, unique: true },
    keyword: { type: String, required: true },
    state: String,
    city: String,
    area: String,
    sources: [{ type: String }],
    totalLeads: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    duration: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    currentFound: { type: Number, default: 0 },
    currentSaved: { type: Number, default: 0 },
    currentDuplicates: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    estimatedTotal: { type: Number, default: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    currentSource: { type: String, default: '' },
    isRunning: { type: Boolean, default: true, index: true },
    failureReason: String,
  },
  {
    timestamps: true,
  }
);

searchHistorySchema.index({ createdAt: -1 });
searchHistorySchema.index({ state: 1, city: 1, area: 1 });
searchHistorySchema.index({ status: 1 });
searchHistorySchema.index({ status: 1, startedAt: -1 });
searchHistorySchema.index({ status: 1, isRunning: 1, startedAt: -1 });
searchHistorySchema.index({ keyword: 1 });
searchHistorySchema.index({ searchSessionId: 1, status: 1 });

export const SearchHistory = model<ISearchHistory>('SearchHistory', searchHistorySchema);
