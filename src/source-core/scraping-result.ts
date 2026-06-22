export interface ScrapingResult {
  source: string;
  keyword: string;
  location: string;
  leads: ScrapedLead[];
  totalScraped: number;
  totalValid: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
  duration: number;
}

export interface ScrapedLead {
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
}
