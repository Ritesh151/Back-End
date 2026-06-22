import { Schema, model, Document, Types } from 'mongoose';

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

export interface IActivity extends Document {
  leadId: Types.ObjectId;
  type: ActivityType;
  timestamp: Date;
  previousValue?: string;
  updatedValue?: string;
  description: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'lead-created',
        'stage-changed',
        'note-added',
        'note-updated',
        'note-deleted',
        'follow-up-created',
        'follow-up-updated',
        'follow-up-deleted',
        'follow-up-completed',
        'lead-assigned',
        'lead-converted',
      ],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    previousValue: {
      type: String,
    },
    updatedValue: {
      type: String,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, ret) => {
        (ret as any).id = (ret as any)._id;
        delete (ret as any)._id;
        return ret;
      },
    },
  }
);

// Create indexes
activitySchema.index({ leadId: 1, timestamp: -1 });
activitySchema.index({ type: 1 });
activitySchema.index({ createdBy: 1 });

export const Activity = model<IActivity>('Activity', activitySchema);
