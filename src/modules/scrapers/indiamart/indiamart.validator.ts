import type { IndiaMartEnrichedLead, ValidationResult } from './indiamart.types';
import { FAKE_PHONE_PATTERNS, isGenericSuggestion } from './indiamart.types';
import { Lead } from '../../../models/Lead';

export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone.trim().length === 0) {
    return { valid: false, reason: 'empty_phone' };
  }

  const cleaned = phone.replace(/[\s\-().]/g, '');
  let digits = cleaned.replace(/[^\d]/g, '');

  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith('91')) digits = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10) {
    return { valid: false, reason: `invalid_length:${digits.length}` };
  }

  if (!/^[6-9]/.test(digits)) {
    return { valid: false, reason: 'non_indian_prefix' };
  }

  for (const pattern of FAKE_PHONE_PATTERNS) {
    if (pattern.test(digits)) {
      return { valid: false, reason: 'fake_phone_pattern' };
    }
  }

  return { valid: true };
}

export function validateWebsiteUrl(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { valid: false, reason: 'empty_url' };
  }

  const lower = url.toLowerCase().trim();

  if (lower.includes('indiamart.com')) {
    return { valid: false, reason: 'indiamart_profile' };
  }
  if (lower.includes('facebook.com') || lower.includes('instagram.com') ||
      lower.includes('linkedin.com') || lower.includes('youtube.com') ||
      lower.includes('twitter.com') || lower.includes('x.com') ||
      lower.includes('wa.me') || lower.includes('whatsapp.com')) {
    return { valid: false, reason: 'social_platform' };
  }
  if (lower.includes('justdial.com') || lower.includes('sulekha.com') ||
      lower.includes('tradeindia.com') || lower.includes('yellowpages')) {
    return { valid: false, reason: 'directory_listing' };
  }
  if (lower.startsWith('javascript:') || lower.startsWith('#') || lower === '') {
    return { valid: false, reason: 'invalid_url' };
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return { valid: false, reason: 'missing_protocol' };
  }

  try {
    const parsed = new URL(lower);
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return { valid: false, reason: 'localhost' };
    }
    const parts = hostname.split('.');
    if (parts.length < 2) {
      return { valid: false, reason: 'invalid_domain' };
    }
    if (parts[parts.length - 1].length < 2) {
      return { valid: false, reason: 'invalid_tld' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'url_parse_failed' };
  }
}

export function validateCompanyName(name: string): ValidationResult {
  if (!name || name.trim().length < 2) {
    return { valid: false, reason: 'name_too_short' };
  }
  if (name.trim().length > 200) {
    return { valid: false, reason: 'name_too_long' };
  }
  if (isGenericSuggestion(name)) {
    return { valid: false, reason: 'generic_name' };
  }
  if (/^[0-9\s]+$/.test(name)) {
    return { valid: false, reason: 'numeric_only' };
  }
  return { valid: true };
}

export function validateAddress(address: string): ValidationResult {
  if (!address || address.trim().length < 5) {
    return { valid: false, reason: 'address_too_short' };
  }
  if (address.trim().length > 500) {
    return { valid: false, reason: 'address_too_long' };
  }
  return { valid: true };
}

export async function findDuplicate(lead: IndiaMartEnrichedLead): Promise<ValidationResult> {
  const conditions: Record<string, unknown>[] = [];

  if (lead.phone && lead.phone.length === 10) {
    conditions.push({ phone: lead.phone });
  }

  if (lead.website) {
    conditions.push({ website: lead.website.toLowerCase() });
  }

  if (lead.companyName && lead.phone) {
    conditions.push({
      companyName: { $regex: new RegExp(`^${escapeRegex(lead.companyName)}$`, 'i') },
      phone: lead.phone,
    });
  }

  if (lead.companyName && lead.address) {
    conditions.push({
      companyName: { $regex: new RegExp(`^${escapeRegex(lead.companyName)}$`, 'i') },
      address: { $regex: new RegExp(escapeRegex(lead.address.slice(0, 30)), 'i') },
    });
  }

  if (conditions.length === 0) {
    conditions.push({
      companyName: { $regex: new RegExp(`^${escapeRegex(lead.companyName)}$`, 'i') },
      source: 'indiamart',
    });
  }

  const existing = await Lead.findOne({ $or: conditions }).catch(() => null);
  if (existing) {
    return { valid: false, reason: 'duplicate_lead' };
  }

  return { valid: true };
}

export async function validateLead(lead: IndiaMartEnrichedLead): Promise<ValidationResult> {
  const nameCheck = validateCompanyName(lead.companyName);
  if (!nameCheck.valid) {
    return { valid: false, reason: `company_name: ${nameCheck.reason}` };
  }

  if (lead.phone) {
    const phoneCheck = validatePhone(lead.phone);
    if (!phoneCheck.valid) {
      return { valid: false, reason: `phone: ${phoneCheck.reason}` };
    }
  }

  if (lead.address) {
    const addrCheck = validateAddress(lead.address);
    if (!addrCheck.valid) {
      return { valid: false, reason: `address: ${addrCheck.reason}` };
    }
  }

  if (lead.website) {
    const urlCheck = validateWebsiteUrl(lead.website);
    if (!urlCheck.valid) {
      lead.website = undefined;
    }
  }

  const dupCheck = await findDuplicate(lead);
  if (!dupCheck.valid) {
    return dupCheck;
  }

  if (!lead.phone && !lead.website && !lead.address) {
    return { valid: false, reason: 'no_contact_info' };
  }

  return { valid: true };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
