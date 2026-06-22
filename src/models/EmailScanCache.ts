import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailScanCache extends Document {
  normalizedDomain: string;
  emails: string[];
  primaryEmail: string;
  emailCount: number;
  lastScanAt: Date;
  expiresAt: Date;
}

const emailScanCacheSchema = new Schema<IEmailScanCache>({
  normalizedDomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
  emails: [{ type: String, lowercase: true, trim: true }],
  primaryEmail: { type: String, lowercase: true, trim: true },
  emailCount: { type: Number, default: 0 },
  lastScanAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
});

emailScanCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailScanCache = mongoose.model<IEmailScanCache>('EmailScanCache', emailScanCacheSchema);
