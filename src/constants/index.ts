// Re-export all constants
export * from './analysis';

export const APP_NAME = 'Lead Finder Agent';

export const API_PREFIX = '/api/v1';

export const PAGINATION_DEFAULT = {
  page: 1,
  limit: 10,
  maxLimit: 100000,
};

// Lead sources - includes all supported directories
export const LEAD_SOURCES = [
  'google-maps',
  'justdial',
  'indiamart',
  'clutch',
  'linkedin',
  'directory',
  'website',
  'manual'
] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

// Extraction sources (the directory/platform where lead was found)
export const EXTRACTION_SOURCES = [
  'google-maps',
  'justdial',
  'indiamart',
  'clutch'
] as const;
export type ExtractionSource = typeof EXTRACTION_SOURCES[number];

// Extraction statuses
export const EXTRACTION_STATUSES = ['success', 'partial', 'failed'] as const;
export type ExtractionStatus = typeof EXTRACTION_STATUSES[number];
