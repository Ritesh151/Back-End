import { Schema, model, Document, Types } from 'mongoose';

export interface IFollowUp extends Document {
  leadId: Types.ObjectId;
  dueDate: Date;
  note?: string;
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const followUpSchema = new Schema<IFollowUp>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
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
followUpSchema.index({ leadId: 1, completed: 1, dueDate: 1 });
followUpSchema.index({ dueDate: 1, completed: 1 });
followUpSchema.index({ completed: 1 });

// Virtual field for overdue status
followUpSchema.virtual('isOverdue').get(function (this: IFollowUp) {
  if (this.completed) return false;
  return new Date() > this.dueDate;
});

export const FollowUp = model<IFollowUp>('FollowUp', followUpSchema);
