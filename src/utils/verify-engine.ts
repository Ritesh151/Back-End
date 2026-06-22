export type PhoneValidationResult = 'valid' | 'invalid' | 'risky';
export type EmailValidationResult = 'valid' | 'invalid' | 'risky' | 'unknown';

export interface PhoneInfo {
  normalized: string;
  isValid: boolean;
  validationResult: PhoneValidationResult;
  isIndian: boolean;
  provider?: string;
}

export interface EmailInfo {
  email: string;
  validationResult: EmailValidationResult;
  isDisposable: boolean;
  domain: string;
  hasMxRecord: boolean | null;
}

export interface AddressInfo {
  normalized: string;
  isValid: boolean;
  state?: string;
  city?: string;
  area?: string;
  issues: string[];
}

const INVALID_PHONE_PATTERNS = [
  /^0{10}$/,
  /^1{10}$/,
  /^2{10}$/,
  /^3{10}$/,
  /^4{10}$/,
  /^5{10}$/,
  /^6{10}$/,
  /^7{10}$/,
  /^8{10}$/,
  /^9{10}$/,
  /^1234567890$/,
  /^9876543210$/,
  /^0123456789$/,
];

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', '10minutemail.com', 'temp-mail.org', 'getnada.com',
  'sharklasers.com', 'trashmail.com', 'mailnesia.com', 'emailondeck.com',
  'dispostable.com', 'maildrop.cc', 'spamgourmet.com', 'fakeinbox.com',
]);

export function normalizePhone(phone: string): string {
  return phone
    .replace(/[\s\-\(\)\+\.]/g, '')
    .replace(/^(91)/, '')
    .replace(/^0+/, '');
}

export function validatePhone(phone: string): PhoneInfo {
  const normalized = normalizePhone(phone);

  if (!/^\d{10}$/.test(normalized)) {
    return { normalized, isValid: false, validationResult: 'invalid', isIndian: false };
  }

  if (!/^[6-9]/.test(normalized)) {
    return { normalized, isValid: false, validationResult: 'invalid', isIndian: true };
  }

  for (const pattern of INVALID_PHONE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { normalized, isValid: false, validationResult: 'invalid', isIndian: true };
    }
  }

  const provider = detectProvider(normalized);

  return {
    normalized,
    isValid: true,
    validationResult: 'valid',
    isIndian: true,
    provider,
  };
}

function detectProvider(phone: string): string | undefined {
  const prefixes: [string, string][] = [
    ['98', 'Reliance Jio'], ['99', 'Reliance Jio'],
    ['97', 'Airtel'], ['96', 'Airtel'],
    ['95', 'Airtel'],
    ['93', 'Vodafone Idea'], ['94', 'Vodafone Idea'],
    ['91', 'Vodafone Idea'], ['92', 'Vodafone Idea'],
    ['70', 'BSNL'], ['71', 'BSNL'],
    ['81', 'Airtel'], ['82', 'Airtel'],
    ['83', 'Reliance Jio'], ['84', 'Vodafone Idea'],
    ['85', 'Airtel'], ['86', 'Vodafone Idea'],
    ['87', 'Reliance Jio'], ['88', 'Airtel'],
    ['89', 'Vodafone Idea'],
  ];

  for (const [prefix, prov] of prefixes) {
    if (phone.startsWith(prefix)) return prov;
  }
  return undefined;
}

export function validateEmail(email: string): EmailInfo {
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split('@');
  const domain = parts.length === 2 ? parts[1] : '';

  const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicRegex.test(trimmed)) {
    return { email: trimmed, validationResult: 'invalid', isDisposable: false, domain, hasMxRecord: null };
  }

  const isDisposable = DISPOSABLE_DOMAINS.has(domain);

  if (isDisposable) {
    return { email: trimmed, validationResult: 'risky', isDisposable: true, domain, hasMxRecord: null };
  }

  return { email: trimmed, validationResult: 'valid', isDisposable: false, domain, hasMxRecord: null };
}

const STATE_CITY_MAP: Record<string, string[]> = {
  'andhra pradesh': ['visakhapatnam', 'vijayawada', 'guntur', 'nellore', 'kurnool', 'rajahmundry', 'tirupati', 'kakinada', 'kadapa', 'anantapur'],
  'bihar': ['patna', 'gaya', 'bhagalpur', 'muzaffarpur', 'purnia', 'darbhanga', 'sasaram', 'hajipur'],
  'delhi': ['delhi', 'new delhi'],
  'gujarat': ['ahmedabad', 'surat', 'vadodara', 'rajkot', 'bhavnagar', 'jamnagar', 'junagadh', 'gandhinagar', 'anand', 'nadiad'],
  'karnataka': ['bengaluru', 'bangalore', 'mysore', 'hubli', 'mangalore', 'belgaum', 'davangere', 'bellary', 'gulbarga', 'shimoga'],
  'kerala': ['thiruvananthapuram', 'kochi', 'kozhikode', 'thrissur', 'alappuzha', 'kollam', 'palakkad', 'kannur', 'kottayam'],
  'madhya pradesh': ['indore', 'bhopal', 'jabalpur', 'gwalior', 'ujjain', 'sagar', 'dewas', 'satna', 'ratlam'],
  'maharashtra': ['mumbai', 'pune', 'nagpur', 'thane', 'nashik', 'aurangabad', 'solapur', 'kolhapur', 'navi mumbai', 'vasai-virar'],
  'rajasthan': ['jaipur', 'jodhpur', 'udaipur', 'kota', 'bikaner', 'ajmer', 'bhilwara', 'alwar', 'sikar'],
  'tamil nadu': ['chennai', 'coimbatore', 'madurai', 'tiruchirappalli', 'salem', 'tirunelveli', 'tiruppur', 'erode', 'vellore', 'thoothukudi'],
  'telangana': ['hyderabad', 'warangal', 'nizamabad', 'karimnagar', 'khammam', 'ramagundam'],
  'uttar pradesh': ['lucknow', 'kanpur', 'agra', 'varanasi', 'meerut', 'allahabad', 'bareilly', 'ghaziabad', 'noida', 'gorakhpur'],
  'west bengal': ['kolkata', 'howrah', 'durgapur', 'asansol', 'siliguri', 'bardhaman', 'kharagpur', 'haldia'],
};

export function validateAddressConsistency(address: string, state?: string, city?: string): AddressInfo {
  const issues: string[] = [];
  const normalized = address.trim();

  if (!normalized) {
    return { normalized, isValid: false, issues: ['Address is empty'] };
  }

  if (normalized.length < 10) {
    issues.push('Address seems too short');
  }

  if (state && city) {
    const stateKey = state.toLowerCase().trim();
    const normalizedCities = STATE_CITY_MAP[stateKey];

    if (normalizedCities) {
      const cityMatch = normalizedCities.some(c => city.toLowerCase().includes(c) || c.includes(city.toLowerCase()));
      if (!cityMatch) {
        issues.push(`City "${city}" may not belong to state "${state}"`);
      }
    }
  }

  if (state && !normalized.toLowerCase().includes(state.toLowerCase().split(' ')[0])) {
    issues.push(`Address does not mention "${state}"`);
  }

  return {
    normalized,
    isValid: issues.length === 0,
    state,
    city,
    issues,
  };
}

const CATEGORY_NORMALIZATIONS: Record<string, string> = {
  'grocery': 'Grocery Store',
  'grocery shop': 'Grocery Store',
  'grocery store': 'Grocery Store',
  'kirana': 'Grocery Store',
  'kirana shop': 'Grocery Store',
  'restaurant': 'Restaurant',
  'restaurants': 'Restaurant',
  'hotel': 'Restaurant',
  'hotels': 'Restaurant',
  'dhaba': 'Restaurant',
  'cafe': 'Cafe',
  'coffee shop': 'Cafe',
  'bakery': 'Bakery',
  'medical': 'Pharmacy',
  'medical store': 'Pharmacy',
  'pharmacy': 'Pharmacy',
  'chemist': 'Pharmacy',
  'salon': 'Salon & Spa',
  'salon & spa': 'Salon & Spa',
  'beauty salon': 'Salon & Spa',
  'spa': 'Salon & Spa',
  'parlour': 'Salon & Spa',
  'beauty parlour': 'Salon & Spa',
  'electronics': 'Electronics Store',
  'electronic shop': 'Electronics Store',
  'mobile shop': 'Mobile Store',
  'mobile store': 'Mobile Store',
  'clothing': 'Clothing Store',
  'clothing store': 'Clothing Store',
  'garments': 'Clothing Store',
  'trading': 'Trading Company',
  'trading company': 'Trading Company',
  'wholesale': 'Wholesale Supplier',
  'retail': 'Retail Store',
  'retail shop': 'Retail Store',
  'furniture': 'Furniture Store',
  'furniture shop': 'Furniture Store',
  'jewellery': 'Jewelry Store',
  'jewelry': 'Jewelry Store',
  'jewellery shop': 'Jewelry Store',
  'hardware': 'Hardware Store',
  'hardware shop': 'Hardware Store',
  'stationery': 'Stationery Store',
  'stationary': 'Stationery Store',
  'book store': 'Book Store',
  'bookseller': 'Book Store',
  'bookshop': 'Book Store',
  'education': 'Educational Institution',
  'school': 'Educational Institution',
  'college': 'Educational Institution',
  'training': 'Training Institute',
  'training institute': 'Training Institute',
  'coaching': 'Training Institute',
  'hospital': 'Hospital',
  'clinic': 'Clinic',
  'nursing home': 'Hospital',
  'dentist': 'Dental Clinic',
  'diagnostic': 'Diagnostic Center',
  'diagnostic centre': 'Diagnostic Center',
  'lab': 'Diagnostic Center',
  'travel': 'Travel Agency',
  'travel agency': 'Travel Agency',
  'tour & travel': 'Travel Agency',
  'transport': 'Transport Service',
  'logistics': 'Transport Service',
  'courier': 'Courier Service',
  'gym': 'Gym & Fitness',
  'fitness': 'Gym & Fitness',
  'yoga': 'Gym & Fitness',
  'auto repair': 'Auto Repair',
  'garage': 'Auto Repair',
  'workshop': 'Auto Repair',
  'mechanic': 'Auto Repair',
  'real estate': 'Real Estate',
  'property': 'Real Estate',
  'builder': 'Real Estate',
  'construction': 'Construction Company',
  'contractor': 'Construction Company',
  'event': 'Event Management',
  'event management': 'Event Management',
  'photography': 'Photography Studio',
  'studio': 'Photography Studio',
  'digital marketing': 'Digital Marketing Agency',
  'marketing': 'Digital Marketing Agency',
  'it services': 'IT Services',
  'software': 'IT Services',
  'web development': 'IT Services',
  'consultant': 'Consultancy',
  'consultancy': 'Consultancy',
  'chartered accountant': 'CA & Accounting',
  'accountant': 'CA & Accounting',
  'advocate': 'Legal Services',
  'lawyer': 'Legal Services',
  'legal': 'Legal Services',
  'dairy': 'Dairy & Milk Products',
  'sweet shop': 'Sweet Shop',
  'mithai': 'Sweet Shop',
  'confectionery': 'Bakery',
  'petrol': 'Petrol Pump',
  'fuel': 'Petrol Pump',
  'gas': 'Gas Agency',
  'lpg': 'Gas Agency',
  'tent house': 'Tent House & Decorators',
  'decoration': 'Tent House & Decorators',
  'decorator': 'Tent House & Decorators',
  'printer': 'Printing & Stationery',
  'printing': 'Printing & Stationery',
  'packers': 'Packers & Movers',
  'movers': 'Packers & Movers',
  'catering': 'Catering Service',
  'caterer': 'Catering Service',
  'tailor': 'Tailoring & Alterations',
  'tailoring': 'Tailoring & Alterations',
  'laundry': 'Laundry & Dry Cleaning',
  'dry clean': 'Laundry & Dry Cleaning',
  'dhobi': 'Laundry & Dry Cleaning',
  'pest control': 'Pest Control Service',
  'security': 'Security Service',
  'guard': 'Security Service',
  'interior': 'Interior Design',
  'interior design': 'Interior Design',
  'architect': 'Architecture & Design',
  'plumber': 'Plumber Service',
  'electrician': 'Electrician Service',
  'painter': 'Painting Service',
  'carpenter': 'Carpentry Service',
  'tourist': 'Tourist Attraction',
};

export function normalizeCategory(category: string): string {
  const normalized = category.trim().toLowerCase();

  if (CATEGORY_NORMALIZATIONS[normalized]) {
    return CATEGORY_NORMALIZATIONS[normalized];
  }

  for (const [key, value] of Object.entries(CATEGORY_NORMALIZATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return category.trim();
}

export function getVerificationScore(lead: {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  category?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  websiteClassification?: string | null;
  socialPlatforms?: string[] | null;
}): number {
  let score = 0;
  const maxScore = 100;

  if (lead.phone) {
    const phoneInfo = validatePhone(lead.phone);
    if (phoneInfo.isValid) score += 20;
    else if (phoneInfo.validationResult === 'risky') score += 10;
  }

  if (lead.email) {
    const emailInfo = validateEmail(lead.email);
    if (emailInfo.validationResult === 'valid') score += 20;
    else if (emailInfo.validationResult === 'risky') score += 10;
  }

  if (lead.website && lead.websiteClassification === 'business_website') {
    score += 20;
  } else if (lead.website) {
    score += 5;
  }

  if (lead.address && lead.address.length > 15) {
    score += 10;
  }

  if (lead.category) {
    const normalized = normalizeCategory(lead.category);
    if (normalized !== lead.category) {
      score += 5;
    } else {
      score += 3;
    }
  }

  if (lead.rating && lead.rating >= 3.5) {
    score += 10;
  } else if (lead.rating) {
    score += 5;
  }

  if (lead.reviewsCount && lead.reviewsCount > 10) {
    score += 10;
  } else if (lead.reviewsCount && lead.reviewsCount > 0) {
    score += 5;
  }

  if (lead.socialPlatforms && lead.socialPlatforms.length > 0) {
    score += 5;
  }

  return Math.min(score, maxScore);
}
