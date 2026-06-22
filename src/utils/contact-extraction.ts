/**
 * Contact extraction utilities
 */

/**
 * Extract emails from text
 */
export function extractEmails(text: string): string[] {
  if (!text) return [];

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const matches = text.match(emailRegex);

  if (!matches) return [];

  // Clean and deduplicate
  return [...new Set(matches.map(email => email.toLowerCase().trim()))];
}

/**
 * Extract phone numbers from text
 */
export function extractPhones(text: string): string[] {
  if (!text) return [];

  const phones: string[] = [];

  // International format with country code
  const intPhoneRegex = /(\+?[\d\s\-\(\)]{10,20})/g;
  const intMatches = text.match(intPhoneRegex);
  if (intMatches) {
    phones.push(...intMatches);
  }

  // Standard formats
  const stdPhoneRegex = /(?:\+?[1-9]\d{1,3}[\s.-]?)?(?:\(?[2-9]\d{2}\)?[\s.-]?)?[2-9]\d{2}[\s.-]?\d{4}/g;
  const stdMatches = text.match(stdPhoneRegex);
  if (stdMatches) {
    phones.push(...stdMatches);
  }

  //Indian format
  const indiaPhoneRegex = /(\+91[\s-]?\d{10}|\d{10})/g;
  const indiaMatches = text.match(indiaPhoneRegex);
  if (indiaMatches) {
    phones.push(...indiaMatches);
  }

  // Clean and deduplicate
  return [...new Set(phones.map(phone => normalizePhone(phone)))];
}

/**
 * Normalize phone number to international format
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';

  let normalized = phone
    .replace(/[^\d+]/g, '') // Keep only digits and +
    .replace(/^0/, '') // Remove leading 0
    .replace(/^(\d{3})(\d{3})(\d{4})$/, '+1-$1-$2-$3'); // US format

  // If starts with 91, it's Indian
  if (normalized.startsWith('91') && normalized.length === 12) {
    normalized = '+' + normalized;
  } else if (normalized.startsWith('1') && normalized.length === 11) {
    normalized = '+' + normalized;
  }

  return normalized;
}

/**
 * Check if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Check if a string is a valid phone number
 */
export function isValidPhone(phone: string): boolean {
  // Remove all non-digits
  const cleaned = phone.replace(/[^\d]/g, '');
  
  // Check length (10-15 digits)
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Extract emails from HTML anchor tags
 */
export function extractEmailsFromLinks(html: string): string[] {
  if (!html) return [];

  const emailLinks: string[] = [];
  const mailtoRegex = /href=["']mailto:([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1];
    if (isValidEmail(email)) {
      emailLinks.push(email);
    }
  }

  return [...new Set(emailLinks)];
}

/**
 * Extract phone links
 */
export function extractPhoneLinks(html: string): string[] {
  if (!html) return [];

  const phoneLinks: string[] = [];
  const telRegex = /href=["']tel:([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = telRegex.exec(html)) !== null) {
    phoneLinks.push(match[1]);
  }

  return phoneLinks;
}
