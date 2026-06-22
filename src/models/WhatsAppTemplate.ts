import { Schema, model, Document } from 'mongoose';

export interface IWhatsAppTemplate extends Document {
  type: 'website' | 'no_website';
  name: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppTemplateSchema = new Schema<IWhatsAppTemplate>(
  {
    type: {
      type: String,
      enum: ['website', 'no_website'],
      required: true,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'whatsapp_templates',
  }
);

export const WhatsAppTemplate = model<IWhatsAppTemplate>('WhatsAppTemplate', whatsAppTemplateSchema);
