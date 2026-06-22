export interface IndiaMartRawListing {
  companyName: string;
  profileUrl: string;
  listingId: string;
  category?: string;
  city?: string;
  state?: string;
  snippet?: string;
  hasPhoneOnListing?: boolean;
  rating?: number;
  reviewsCount?: number;
}

export interface IndiaMartEnrichedLead {
  companyName: string;
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gst?: string;
  ownerName?: string;
  category?: string;
  products?: string[];
  services?: string[];
  rating?: number;
  reviewsCount?: number;
  yearOfEstablishment?: number;
  employeeCount?: string;
  profileUrl: string;
  sourceUrl: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    youtube?: string;
    twitter?: string;
    whatsapp?: string;
  };
  images?: string[];
  latitude?: number;
  longitude?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ScraperStats {
  totalListingsFound: number;
  totalProfilesOpened: number;
  totalProfilesFailed: number;
  totalLeadsSaved: number;
  totalDuplicatesSkipped: number;
  totalInvalidRejected: number;
  errors: string[];
}

export const INDIA_MART_SEARCH_URL = 'https://dir.indiamart.com/search.mp';

export const KNOWN_GENERIC_NAMES = new Set([
  'plain t shirts', 'polo t shirts', 'round neck t shirts',
  'printed t shirts', 'cotton t-shirts', 'bulk t-shirts',
  'corporate t-shirts', 'login to connect', 'all india',
  'get best price', 'related searches', 'send enquiry',
  'contact supplier', 'view more', 'load more',
]);

export const FAKE_PHONE_PATTERNS = [
  /^(\d)\1{9}$/,
  /^1234567890$/,
  /^0123456789$/,
  /^9876543210$/,
  /^9999999999$/,
  /^0{10}$/,
  /^1{10}$/,
  /^5{10}$/,
];

export function isGenericSuggestion(name: string): boolean {
  const lower = name.toLowerCase().trim();
  for (const g of KNOWN_GENERIC_NAMES) {
    if (lower.includes(g)) return true;
  }
  return false;
}
