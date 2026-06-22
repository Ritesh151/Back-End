export interface SourceSelector {
  businessCard: string;
  companyName: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  rating?: string;
  category?: string;
}

export interface SourceConfig {
  sourceName: string;
  baseUrl: string;
  selectors: SourceSelector;
  timeout: number;
  maxRetries: number;
  headless: boolean;
  customHeaders?: Record<string, string>;
}

export interface JustdialConfig extends SourceConfig {
  cityPattern?: string;
}

export interface IndiaMartConfig extends SourceConfig {
  supplierType?: string;
}

export interface ClutchConfig extends SourceConfig {
  serviceCategory?: string;
  locationPattern?: string;
}
