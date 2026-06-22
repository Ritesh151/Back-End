import * as cheerio from 'cheerio';
import type { IndiaMartRawListing, IndiaMartEnrichedLead } from './indiamart.types';

export function parseListingPage(
  html: string,
  existingNames: Set<string>
): IndiaMartRawListing[] {
  const $ = cheerio.load(html);
  const listings: IndiaMartRawListing[] = [];
  const seen = new Set<string>();

  const cardSelectors = [
    '.srch_product_box',
    '.product-box',
    '.seller-card',
    '.seller_listing',
    '.listingPage',
    '.prd-card',
    '.seller-card-new',
    '.lising-product',
    '.rht',
    '.list-item',
  ];

  let cards = $(cardSelectors.join(', '));
  if (cards.length === 0) {
    cards = $('a[href*="indiamart.com"]').filter((_, el) => {
      const text = $(el).text().trim();
      return text.length > 2 && text.length < 200;
    }).parent();
  }

  for (let i = 0; i < cards.length; i++) {
    const card = $(cards[i]);

    const name = extractCompanyName($, card);
    if (!name || name.length < 2) continue;
    if (seen.has(name.toLowerCase())) continue;

    const profileUrl = extractProfileUrl($, card);
    if (!profileUrl) continue;

    const listingId = profileUrl.split('/').pop() || name.replace(/\s+/g, '-').toLowerCase();
    const dedupKey = `${name}|${listingId}`;
    if (existingNames.has(dedupKey) || seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const category = extractCategory($, card);
    const city = extractCity($, card);
    const state = extractState($, card) || extractStateFromCity(city);
    const snippet = extractSnippet($, card);
    const hasPhoneOnListing = detectPhone($, card);
    const rating = extractRating($, card);

    listings.push({
      companyName: name,
      profileUrl,
      listingId,
      category,
      city,
      state,
      snippet,
      hasPhoneOnListing,
      rating: rating.rating,
      reviewsCount: rating.reviewsCount,
    });
  }

  return listings;
}

export function parseProfilePage(
  html: string,
  profileUrl: string
): Partial<IndiaMartEnrichedLead> {
  const $ = cheerio.load(html);
  const lead: Partial<IndiaMartEnrichedLead> = {
    profileUrl,
    sourceUrl: profileUrl,
    socialLinks: {},
  };

  lead.companyName = extractProfileCompanyName($) || extractMetaTitle($);

  const phones = extractPhones($);
  if (phones.length > 0) {
    lead.phone = phones[0];
    if (phones.length > 1) lead.secondaryPhone = phones[1];
  }

  lead.email = extractEmail($);
  lead.website = extractWebsite($);
  lead.gst = extractGst($);
  lead.ownerName = extractOwnerName($);
  lead.category = extractProfileCategory($);
  lead.products = extractProducts($);
  lead.services = extractServices($);
  lead.yearOfEstablishment = extractYearOfEstablishment($);
  lead.employeeCount = extractEmployeeCount($);

  const addressParts = extractAddressParts($);
  lead.address = addressParts.fullAddress;
  lead.city = addressParts.city;
  lead.state = addressParts.state;
  lead.pincode = addressParts.pincode;

  lead.socialLinks = extractSocialLinks($);
  lead.images = extractImages($);

  const coords = extractCoordinates($);
  lead.latitude = coords.lat;
  lead.longitude = coords.lng;

  const rating = extractProfileRating($);
  lead.rating = rating.rating;

  return lead;
}

function extractCompanyName($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string | null {
  const selectors = [
    '.seller_name', '.name', '[class*="name"]', '[class*="title"]',
    '.product_name', 'h2', 'h3', 'a[href*="indiamart.com"]',
  ];
  for (const sel of selectors) {
    const el = $(sel, card).first();
    const text = el.text().trim();
    if (text.length >= 2 && text.length < 150) return cleanName(text);
  }
  return null;
}

function extractProfileUrl($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string | null {
  const selectors = [
    'a[href*="indiamart.com"]',
    'a[href*="/profile/"]',
    'a[href*="/supplier/"]',
  ];
  for (const sel of selectors) {
    const href = $(sel, card).first().attr('href');
    if (href && href.includes('indiamart.com') && !href.includes('search.mp')) {
      return href.startsWith('http') ? href : `https://www.indiamart.com${href}`;
    }
  }
  const allLinks = $('a[href]', card);
  for (let i = 0; i < allLinks.length; i++) {
    const href = $(allLinks[i]).attr('href') || '';
    if (href.includes('indiamart.com') && !href.includes('search.mp') && !href.includes('javascript')) {
      return href.startsWith('http') ? href : `https://www.indiamart.com${href}`;
    }
  }
  return null;
}

function extractCategory($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string | undefined {
  const selectors = ['.cat_list a', '.category', '[class*="cat"]', '.product-category'];
  for (const sel of selectors) {
    const text = $(sel, card).first().text().trim();
    if (text && text.length < 100) return text;
  }
  return undefined;
}

function extractCity($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string | undefined {
  const selectors = ['.city', '[class*="city"]', '.location', '.addr_text', '.seller-address'];
  for (const sel of selectors) {
    const text = $(sel, card).first().text().trim();
    if (text && text.length < 50) return text;
  }
  return undefined;
}

function extractState($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string | undefined {
  const selectors = ['.state', '[class*="state"]', '.region'];
  for (const sel of selectors) {
    const text = $(sel, card).first().text().trim();
    if (text && text.length < 50) return text;
  }
  return undefined;
}

function extractStateFromCity(city?: string): string | undefined {
  if (!city) return undefined;
  const stateMap: Record<string, string> = {
    'delhi': 'Delhi',
    'new delhi': 'Delhi',
    'mumbai': 'Maharashtra',
    'pune': 'Maharashtra',
    'nagpur': 'Maharashtra',
    'nashik': 'Maharashtra',
    'thane': 'Maharashtra',
    'aurangabad': 'Maharashtra',
    'bangalore': 'Karnataka',
    'bengaluru': 'Karnataka',
    'mysore': 'Karnataka',
    'hubli': 'Karnataka',
    'chennai': 'Tamil Nadu',
    'coimbatore': 'Tamil Nadu',
    'madurai': 'Tamil Nadu',
    'hyderabad': 'Telangana',
    'kolkata': 'West Bengal',
    'ahmedabad': 'Gujarat',
    'surat': 'Gujarat',
    'vadodara': 'Gujarat',
    'rajkot': 'Gujarat',
    'jaipur': 'Rajasthan',
    'jodhpur': 'Rajasthan',
    'udaipur': 'Rajasthan',
    'lucknow': 'Uttar Pradesh',
    'kanpur': 'Uttar Pradesh',
    'agra': 'Uttar Pradesh',
    'varanasi': 'Uttar Pradesh',
    'noida': 'Uttar Pradesh',
    'ghaziabad': 'Uttar Pradesh',
    'chandigarh': 'Chandigarh',
    'bhopal': 'Madhya Pradesh',
    'indore': 'Madhya Pradesh',
    'gurgaon': 'Haryana',
    'faridabad': 'Haryana',
    'patna': 'Bihar',
    'ranchi': 'Jharkhand',
    'bhubaneswar': 'Odisha',
    'guwahati': 'Assam',
    'dehradun': 'Uttarakhand',
    'shimla': 'Himachal Pradesh',
    'srinagar': 'Jammu and Kashmir',
    'panaji': 'Goa',
    'vijayawada': 'Andhra Pradesh',
    'visakhapatnam': 'Andhra Pradesh',
    'kochi': 'Kerala',
    'trivandrum': 'Kerala',
    'calicut': 'Kerala',
    'amritsar': 'Punjab',
    'ludhiana': 'Punjab',
    'jalandhar': 'Punjab',
    'panchkula': 'Haryana',
    'ambala': 'Haryana',
    'sonipat': 'Haryana',
  };
  const lower = city.toLowerCase().trim();
  return stateMap[lower] || undefined;
}

function extractSnippet($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string | undefined {
  const selectors = ['.product_desc', '.seller_desc', '.description', '[class*="desc"]'];
  for (const sel of selectors) {
    const text = $(sel, card).first().text().trim();
    if (text && text.length > 5) return text;
  }
  return undefined;
}

function detectPhone(_$: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): boolean {
  const text = card.text() || '';
  return /(\+?91[\s-]?)?[6-9]\d{9}/.test(text);
}

function extractRating($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): { rating?: number; reviewsCount?: number } {
  const selectors = ['[class*="rating"]', '[class*="star"]', '.rating'];
  for (const sel of selectors) {
    const text = $(sel, card).first().text().trim();
    if (text) {
      const match = text.match(/(\d+\.?\d*)/);
      if (match) {
        const rating = parseFloat(match[1]);
        const reviewMatch = text.match(/([\d,]+)\s*reviews?/i);
        const reviewsCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : undefined;
        return { rating, reviewsCount };
      }
    }
  }
  return {};
}

function cleanName(name: string): string {
  return name.replace(/^\d+\.\s*/, '').replace(/\s+/g, ' ').trim();
}

function extractMetaTitle($: cheerio.CheerioAPI): string | undefined {
  const title = $('title').first().text().trim();
  if (title) {
    return title.split('|')[0]?.trim() || title.split('-')[0]?.trim() || title;
  }
  return undefined;
}

function extractProfileCompanyName($: cheerio.CheerioAPI): string | undefined {
  const selectors = [
    'h1', '.company-name', '[class*="company"] h1',
    '.seller-name', '.vendor-name', '.brand-name',
    '.profile-name', '[class*="profile"] h1',
  ];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text && text.length >= 2 && text.length < 150) return cleanName(text);
  }
  return undefined;
}

function extractPhones($: cheerio.CheerioAPI): string[] {
  const phones: string[] = [];
  const phoneSelectors = [
    'a[href^="tel:"]',
    '.contact-num',
    '.phone-num',
    '[class*="phone"]',
    '[class*="mobile"]',
    '[class*="contact"]',
    '.mob-num',
    '.call-now',
    '.call-btn',
  ];
  for (const sel of phoneSelectors) {
    $(sel).each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const raw = href.replace('tel:', '') || text;
      const cleaned = raw.replace(/[\s\-().]/g, '');
      const digits = cleaned.replace(/[^\d]/g, '');
      let normalized = digits;
      if (digits.length === 12 && digits.startsWith('91')) normalized = digits.slice(2);
      else if (digits.length === 13 && digits.startsWith('91')) normalized = digits.slice(3);
      else if (digits.length === 11 && digits.startsWith('0')) normalized = digits.slice(1);
      if (normalized.length === 10 && /^[6-9]/.test(normalized) && !phones.includes(normalized)) {
        phones.push(normalized);
      }
    });
  }
  if (phones.length === 0) {
    const text = $('body').text();
    const matches = text.match(/(\+?91[\s-]?)?[6-9]\d{9}/g);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.replace(/[\s-]/g, '');
        const digits = cleaned.replace(/[^\d]/g, '');
        let normalized = digits;
        if (digits.length === 12 && digits.startsWith('91')) normalized = digits.slice(2);
        else if (digits.length === 13 && digits.startsWith('91')) normalized = digits.slice(3);
        else if (digits.length === 11 && digits.startsWith('0')) normalized = digits.slice(1);
        if (normalized.length === 10 && /^[6-9]/.test(normalized) && !phones.includes(normalized)) {
          phones.push(normalized);
        }
      }
    }
  }
  return phones;
}

function extractEmail($: cheerio.CheerioAPI): string | undefined {
  const mailto = $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '');
  if (mailto) return mailto.trim();
  const text = $('body').text();
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : undefined;
}

function extractWebsite($: cheerio.CheerioAPI): string | undefined {
  const selectors = [
    'a[href*="www."]:not([href*="indiamart.com"]):not([href*="facebook"]):not([href*="instagram"]):not([href*="linkedin"]):not([href*="youtube"]):not([href*="twitter"])',
    'a.website-link',
    '[class*="website"] a',
    '.web-url a',
  ];
  for (const sel of selectors) {
    const href = $(sel).first().attr('href');
    if (href && !href.includes('indiamart.com') && !href.startsWith('javascript')) {
      return normalizeUrl(href);
    }
  }
  const text = $('body').text();
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?(?!indiamart)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/);
  if (match && !match[0].includes('indiamart') && !match[0].includes('facebook') && !match[0].includes('instagram')) {
    return normalizeUrl(match[0]);
  }
  return undefined;
}

function extractGst($: cheerio.CheerioAPI): string | undefined {
  const selectors = ['.gst', '[class*="gst"]', '[class*="GST"]', '.gst-number', '.gstin'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text && /\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]/.test(text)) {
      const match = text.match(/\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]/);
      if (match) return match[0];
    }
  }
  const bodyText = $('body').text();
  const match = bodyText.match(/\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]/);
  return match ? match[0] : undefined;
}

function extractOwnerName($: cheerio.CheerioAPI): string | undefined {
  const selectors = [
    '.owner-name', '.proprietor', '[class*="owner"]',
    '.contact-person', '.manager', '.director',
  ];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text && text.length >= 2 && text.length < 60 && !text.match(/^\d/)) {
      return text;
    }
  }
  return undefined;
}

function extractProfileCategory($: cheerio.CheerioAPI): string | undefined {
  const selectors = [
    '.category', '.product-category', '.business-type',
    '[class*="category"]', '.service-type', '.seller-type',
  ];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text && text.length < 100) return text;
  }
  return undefined;
}

function extractProducts($: cheerio.CheerioAPI): string[] {
  const products: string[] = [];
  const selectors = [
    '.product-list li', '.product-item', '[class*="product"] li',
    '.our-products li', '.deals-in li',
  ];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length >= 2 && text.length < 150) {
        products.push(text);
      }
    });
  }
  return [...new Set(products)];
}

function extractServices($: cheerio.CheerioAPI): string[] {
  const services: string[] = [];
  const selectors = [
    '.service-list li', '.service-item', '[class*="service"] li',
    '.our-services li',
  ];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length >= 2 && text.length < 150) {
        services.push(text);
      }
    });
  }
  return [...new Set(services)];
}

function extractYearOfEstablishment($: cheerio.CheerioAPI): number | undefined {
  const selectors = [
    '.year', '.est-year', '[class*="year"]',
    '.establishment', '[class*="est"]',
  ];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const match = text.match(/(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      if (year > 1900 && year <= new Date().getFullYear()) return year;
    }
  }
  return undefined;
}

function extractEmployeeCount($: cheerio.CheerioAPI): string | undefined {
  const selectors = [
    '.employee-count', '[class*="employee"]',
    '.team-size', '[class*="team"]',
    '.staff-count', '.no-of-employees',
  ];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text && text.length < 50) return text;
  }
  return undefined;
}

function extractAddressParts($: cheerio.CheerioAPI): {
  fullAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
} {
  const selectors = [
    '.address', '.addr', '.location', '.office-address',
    '[class*="address"]', '[class*="location"]',
  ];
  let fullAddress = '';
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text && text.length > 5) {
      fullAddress = text;
      break;
    }
  }
  if (!fullAddress) {
    const addrSelectors = [
      '.seller-address', '.company-address', '.cont-dtl',
      '.contact-details', '.info-list',
    ];
    for (const sel of addrSelectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length > 5) {
        fullAddress = text;
        break;
      }
    }
  }

  let city: string | undefined;
  let state: string | undefined;
  let pincode: string | undefined;

  if (fullAddress) {
    const pincodeMatch = fullAddress.match(/\b(\d{6})\b/);
    if (pincodeMatch) pincode = pincodeMatch[1];

    const lines = fullAddress.split(',').map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      const stateMatch = line.match(/\b(Maharashtra|Karnataka|Tamil Nadu|Telangana|Kerala|Andhra Pradesh|Uttar Pradesh|Gujarat|Rajasthan|Madhya Pradesh|West Bengal|Bihar|Odisha|Assam|Haryana|Punjab|Jharkhand|Chhattisgarh|Uttarakhand|Himachal Pradesh|Jammu and Kashmir|Goa|Delhi|Puducherry|Chandigarh|Sikkim|Arunachal Pradesh|Nagaland|Manipur|Mizoram|Meghalaya|Tripura|Ladakh|Lakshadweep|Andaman and Nicobar|Dadra and Nagar Haveli and Daman and Diu)\b/i);
      if (stateMatch) state = stateMatch[1];

      const cityMatch = line.match(/\b(Mumbai|Delhi|Bangalore|Bengaluru|Chennai|Hyderabad|Kolkata|Pune|Ahmedabad|Jaipur|Lucknow|Kanpur|Nagpur|Indore|Bhopal|Surat|Vadodara|Rajkot|Coimbatore|Madurai|Visakhapatnam|Vijayawada|Kochi|Trivandrum|Calicut|Mysore|Hubli|Chandigarh|Dehradun|Shimla|Srinagar|Guwahati|Patna|Ranchi|Bhubaneswar|Amritsar|Ludhiana|Jalandhar|Agra|Varanasi|Noida|Ghaziabad|Gurgaon|Faridabad|Nashik|Thane|Aurangabad|Panaji|Udaipur|Jodhpur)\b/i);
      if (cityMatch && !city) city = cityMatch[1];
    }

    if (!city && pincode) {
      city = extractCityFromPincode(pincode);
    }
  }

  return { fullAddress: fullAddress || undefined, city, state, pincode };
}

function extractCityFromPincode(pincode: string): string | undefined {
  const prefix = pincode.slice(0, 3);
  const cityMap: Record<string, string> = {
    '110': 'Delhi', '400': 'Mumbai', '411': 'Pune', '560': 'Bangalore',
    '600': 'Chennai', '500': 'Hyderabad', '700': 'Kolkata', '380': 'Ahmedabad',
    '302': 'Jaipur', '226': 'Lucknow', '208': 'Kanpur', '440': 'Nagpur',
    '452': 'Indore', '462': 'Bhopal', '395': 'Surat', '390': 'Vadodara',
    '641': 'Coimbatore', '625': 'Madurai', '530': 'Visakhapatnam',
    '520': 'Vijayawada', '682': 'Kochi', '695': 'Trivandrum',
    '673': 'Calicut', '570': 'Mysore', '160': 'Chandigarh',
    '248': 'Dehradun', '171': 'Shimla', '190': 'Srinagar',
    '781': 'Guwahati', '800': 'Patna', '834': 'Ranchi',
    '751': 'Bhubaneswar', '143': 'Amritsar', '141': 'Ludhiana',
    '144': 'Jalandhar', '282': 'Agra', '221': 'Varanasi',
    '201': 'Noida', '122': 'Gurgaon',
    '121': 'Faridabad', '422': 'Nashik',
    '431': 'Aurangabad', '403': 'Panaji', '313': 'Udaipur',
    '342': 'Jodhpur', '482': 'Jabalpur',
  };
  return cityMap[prefix];
}

function extractSocialLinks($: cheerio.CheerioAPI): IndiaMartEnrichedLead['socialLinks'] {
  const social: IndiaMartEnrichedLead['socialLinks'] = {};
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const lower = href.toLowerCase();
    if (lower.includes('facebook.com') && !social.facebook) social.facebook = href;
    if (lower.includes('instagram.com') && !social.instagram) social.instagram = href;
    if (lower.includes('linkedin.com') && !social.linkedin) social.linkedin = href;
    if (lower.includes('youtube.com') && !social.youtube) social.youtube = href;
    if (lower.includes('twitter.com') && !social.twitter) social.twitter = href;
    if (lower.startsWith('tel:') && !social.whatsapp) {
      const num = lower.replace('tel:', '').trim();
      if (/^\d{10,}$/.test(num.replace(/[\s-]/g, ''))) {
        social.whatsapp = `https://wa.me/${num.replace(/[\s-]/g, '')}`;
      }
    }
  });
  return social;
}

function extractImages($: cheerio.CheerioAPI): string[] {
  const images: string[] = [];
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.startsWith('http') && !src.includes('logo') && !src.includes('icon') && !src.includes('banner')) {
      images.push(src);
    }
  });
  return images.slice(0, 10);
}

function extractCoordinates($: cheerio.CheerioAPI): { lat?: number; lng?: number } {
  const scripts = $('script').map((_, el) => $(el).html() || '').get();
  for (const script of scripts) {
    const latMatch = script.match(/["']latitude["']\s*:\s*([\d.-]+)/);
    const lngMatch = script.match(/["']longitude["']\s*:\s*([\d.-]+)/);
    if (latMatch && lngMatch) {
      return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
    }
  }
  return {};
}

function extractProfileRating($: cheerio.CheerioAPI): { rating?: number } {
  const selectors = ['[class*="rating"]', '[class*="star"]', '.rating', '.reviews'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const match = text.match(/(\d+\.?\d*)/);
    if (match) return { rating: parseFloat(match[1]) };
  }
  return {};
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  try {
    const parsed = new URL(normalized);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return normalized;
  }
}
