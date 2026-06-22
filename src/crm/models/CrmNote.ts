import { Schema, model, Document, Types } from 'mongoose';

export interface INote extends Document {
  leadId: Types.ObjectId;
  content: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    author: {
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
noteSchema.index({ leadId: 1, createdAt: -1 });
noteSchema.index({ author: 1 });

export const Note = model<INote>('Note', noteSchema);
