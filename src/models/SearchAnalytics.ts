import { Schema, model, Document } from 'mongoose';

export interface ISearchAnalytics extends Document {
  sessionId: string;
  keyword: string;
  expandedKeywords: string[];
  state?: string;
  city?: string;
  area?: string;
  location: string;
  sources: string[];
  totalLeadsFound: number;
  totalUniqueLeads: number;
  totalDuplicatesRemoved: number;
  sourceBreakdown: Record<string, number>;
  keywordBreakdown: Record<string, number>;
  status: 'running' | 'completed' | 'failed';
  duration: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

const SearchAnalyticsSchema = new Schema<ISearchAnalytics>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    keyword: { type: String, required: true, index: true },
    expandedKeywords: [{ type: String }],
    state: String,
    city: String,
    area: String,
    location: { type: String, default: '' },
    sources: [{ type: String }],
    totalLeadsFound: { type: Number, default: 0 },
    totalUniqueLeads: { type: Number, default: 0 },
    totalDuplicatesRemoved: { type: Number, default: 0 },
    sourceBreakdown: { type: Schema.Types.Mixed, default: {} },
    keywordBreakdown: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    duration: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    error: String,
  },
  { timestamps: true }
);

SearchAnalyticsSchema.index({ keyword: 1, createdAt: -1 });
SearchAnalyticsSchema.index({ status: 1, createdAt: -1 });

export const SearchAnalytics = model<ISearchAnalytics>('SearchAnalytics', SearchAnalyticsSchema);
