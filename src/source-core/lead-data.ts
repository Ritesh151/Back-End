export interface LeadData {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  source: string;
  keyword: string;
  location: string;
  scrapedAt: Date;
  metadata?: Record<string, any>;
}
