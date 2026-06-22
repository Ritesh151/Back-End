import { validatePhone, validateEmail, normalizeCategory } from './verify-engine';

export interface QualityScore {
  total: number;
  maxScore: number;
  breakdown: {
    phone: number;
    email: number;
    website: number;
    address: number;
    category: number;
    rating: number;
    reviews: number;
    social: number;
    completeness: number;
  };
  label: 'excellent' | 'good' | 'average' | 'poor';
}

export function calculateQualityScore(lead: {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  category?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  websiteClassification?: string | null;
  socialPlatforms?: string[] | null;
  companyName?: string | null;
}): QualityScore {
  const breakdown = {
    phone: 0,
    email: 0,
    website: 0,
    address: 0,
    category: 0,
    rating: 0,
    reviews: 0,
    social: 0,
    completeness: 0,
  };

  const maxBreakdown = {
    phone: 15,
    email: 15,
    website: 15,
    address: 10,
    category: 10,
    rating: 10,
    reviews: 10,
    social: 5,
    completeness: 10,
  };

  if (lead.phone) {
    const phoneInfo = validatePhone(lead.phone);
    if (phoneInfo.isValid && phoneInfo.provider) {
      breakdown.phone = 15;
    } else if (phoneInfo.isValid) {
      breakdown.phone = 12;
    } else if (phoneInfo.validationResult === 'risky') {
      breakdown.phone = 5;
    }
  }

  if (lead.email) {
    const emailInfo = validateEmail(lead.email);
    if (emailInfo.validationResult === 'valid' && !emailInfo.isDisposable && emailInfo.domain) {
      breakdown.email = 15;
    } else if (emailInfo.validationResult === 'valid') {
      breakdown.email = 12;
    } else if (emailInfo.validationResult === 'risky') {
      breakdown.email = 5;
    }
  }

  if (lead.website) {
    if (lead.websiteClassification === 'business_website') {
      breakdown.website = 15;
    } else {
      breakdown.website = 5;
    }
  }

  if (lead.address && lead.address.length > 20) {
    breakdown.address = 10;
  } else if (lead.address) {
    breakdown.address = 5;
  }

  if (lead.category) {
    const normalized = normalizeCategory(lead.category);
    if (normalized !== lead.category) {
      breakdown.category = 10;
    } else {
      breakdown.category = 7;
    }
  }

  if (lead.rating) {
    if (lead.rating >= 4.0) {
      breakdown.rating = 10;
    } else if (lead.rating >= 3.0) {
      breakdown.rating = 7;
    } else {
      breakdown.rating = 3;
    }
  }

  if (lead.reviewsCount) {
    if (lead.reviewsCount >= 50) {
      breakdown.reviews = 10;
    } else if (lead.reviewsCount >= 10) {
      breakdown.reviews = 7;
    } else {
      breakdown.reviews = 3;
    }
  }

  if (lead.socialPlatforms && lead.socialPlatforms.length > 0) {
    breakdown.social = Math.min(lead.socialPlatforms.length * 2, 5);
  }

  const fields = [lead.phone, lead.email, lead.website, lead.address, lead.category, lead.companyName];
  const nonEmpty = fields.filter(f => f && f.length > 0).length;
  breakdown.completeness = Math.round((nonEmpty / fields.length) * 10);

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const maxScore = Object.values(maxBreakdown).reduce((sum, v) => sum + v, 0);

  let label: QualityScore['label'];
  const percentage = (total / maxScore) * 100;
  if (percentage >= 80) label = 'excellent';
  else if (percentage >= 60) label = 'good';
  else if (percentage >= 40) label = 'average';
  else label = 'poor';

  return { total, maxScore, breakdown, label };
}

export function calculateLeadTrustScore(lead: {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  websiteClassification?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  source?: string | null;
  finalConfidence?: number | null;
  verificationScore?: number | null;
}): number {
  let score = 0;
  const weights = {
    phone: 20,
    email: 20,
    website: 15,
    rating: 15,
    source: 15,
    confidence: 15,
  };

  if (lead.phone) {
    const { isValid } = validatePhone(lead.phone);
    score += isValid ? weights.phone : weights.phone * 0.3;
  }

  if (lead.email) {
    const { validationResult } = validateEmail(lead.email);
    score += validationResult === 'valid' ? weights.email : weights.email * 0.3;
  }

  if (lead.website && lead.websiteClassification === 'business_website') {
    score += weights.website;
  } else if (lead.website) {
    score += weights.website * 0.3;
  }

  if (lead.rating) {
    score += (lead.rating / 5) * weights.rating;
  }

  if (lead.source) {
    const sourceScore: Record<string, number> = {
      'google-maps': 0.85,
      'justdial': 0.7,
      'indiamart': 0.65,
      'clutch': 0.75,
      'manual': 0.9,
    };
    score += (sourceScore[lead.source] ?? 0.5) * weights.source;
  }

  if (lead.finalConfidence) {
    score += (lead.finalConfidence / 100) * weights.confidence;
  }

  return Math.round(Math.min(score, 100));
}

export function calculateDataQuality(lead: {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  category?: string | null;
  companyName?: string | null;
}): number {
  const fields = [
    { name: 'companyName', weight: 25, value: lead.companyName },
    { name: 'phone', weight: 20, value: lead.phone },
    { name: 'email', weight: 20, value: lead.email },
    { name: 'website', weight: 15, value: lead.website },
    { name: 'address', weight: 10, value: lead.address },
    { name: 'category', weight: 10, value: lead.category },
  ];

  let score = 0;
  for (const field of fields) {
    if (field.value && field.value.length > 0) {
      score += field.weight;
    }
  }

  return score;
}

export type LeadQuality = 'excellent' | 'good' | 'average' | 'poor';
