import { z } from 'zod';

// India states validation
const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep", "Delhi", "Puducherry", "Ladakh", "Jammu and Kashmir",
] as const;

const IndiaStateSchema = z.enum(INDIA_STATES);

// Validation schema for search requests
export const searchRequestSchema = z.object({
  body: z.object({
    keyword: z.string().min(1, 'Keyword is required').max(255),
    location: z.string().optional(),
    state: IndiaStateSchema.optional(),
    city: z.string().optional(),
    area: z.string().optional(),
    businessType: z.string().optional(),
    sources: z.array(z.string()).optional(),
    limit: z.number().optional().default(1000),
    sessionId: z.string().optional(),
    semanticExpansion: z.boolean().optional(),
  }).passthrough(),
});

export type SearchRequestDTO = z.infer<typeof searchRequestSchema>;
