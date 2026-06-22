export interface CategoryGroup {
  id: string;
  name: string;
  keywords: string[];
  priority: number;
}

export interface ExpandedKeyword {
  keyword: string;
  originalQuery: string;
  categoryGroupId: string;
  categoryGroupName: string;
  priority: number;
  isPrimary: boolean;
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'fitness-health',
    name: 'Fitness & Health',
    priority: 1,
    keywords: [
      'gym', 'fitness center', 'fitness', 'yoga', 'yoga center', 'yoga studio',
    ],
  },
  
  {
    id: 'fashion-clothing',
    name: 'Fashion & Clothing',
    priority: 2,
    keywords: [
      'clothing store', 'boutique', 'fashion shop', 'mens wear shop',
      'womens wear shop', 'kids clothing store', 'footwear shop',
      'shoe store', 'accessories shop', 'bag store', 'belt shop',
      'tailoring shop', 'alteration shop', 'ethnic wear store',
      'saree shop', 'lehenga shop', 'bridal boutique', 'uniform shop',
      'sportswear store', 'jeans shop', 'western wear store',
      'lingerie shop', 'nightwear store', 'maternity wear store',
      'couture boutique', 'fashion designer', 'textile shop',
      'cloth shop', 'garment store', 'dress shop',
    ],
  },
  {
    id: 'food-beverage',
    name: 'Food & Beverage',
    priority: 1,
    keywords: [
      'restaurant', 'food place', 'dining', 'eatery', 'cafe', 'café',
      'diner', 'bistro', 'dhaba', 'street food stall', 'food court',
      'takeaway restaurant', 'delivery restaurant', 'fast food shop',
      'juice shop', 'smoothie bar', 'bakery', 'cake shop',
      'ice cream parlor', 'food truck', 'fine dining restaurant',
      'family restaurant', 'veg restaurant', 'non veg restaurant',
      'multicuisine restaurant', 'pizza shop', 'burger joint',
      'sandwich shop', 'south indian restaurant', 'north indian restaurant',
      'chinese restaurant', 'punjabi dhaba', 'gujarati thali',
      'seafood restaurant', 'bbq restaurant', 'grill restaurant',
      'buffet restaurant', 'catering service', 'cloud kitchen',
      'dark kitchen', 'home food service', 'tiffin service',
      'mess', 'canteen', 'snacks shop', 'chat shop', 'sweets shop',
      'confectionery', 'patisserie', 'donut shop', 'coffee shop',
      'tea stall', 'chai shop', 'cold drink shop', 'bar',
      'pub', 'lounge', 'night club', 'microbrewery', 'wine shop',
      'liquor store', 'beer shop',
    ],
  },
  {
    id: 'travel-hospitality',
    name: 'Travel & Hospitality',
    priority: 1,
    keywords: [
      'hotel', 'hotels', 'guest house', 'guest houses', 'inn',
      'stay', 'stays', 'lodge', 'luxury hotel', 'budget hotel', 'heritage hotel',
    ],
  },
  {
    id: 'retail-shops',
    name: 'Retail & Shops',
    priority: 2,
    keywords: [
      'grocery store', 'supermarket', 'electronics shop', 'mobile shop',
      'computer store', 'hardware shop', 'stationery shop', 'gift shop',
      'general store', 'retail shop', 'departmental store', 'mall',
      'kirana store', 'provision store', 'wholesale shop',
      'home decor store', 'furniture shop', 'appliance store',
      'electrical shop', 'plumbing shop', 'paint shop',
      'tile shop', 'marble shop', 'sanitaryware shop',
      'book store', 'library', 'toy shop', 'baby store',
      'pet shop', 'pet store', 'florist', 'flower shop',
      'plant nursery', 'garden center', 'jewellery shop',
      'watch shop', 'sunglasses shop', 'optical shop',
      'handicraft store', 'antique shop', 'art gallery',
      'souvenir shop', 'chemist', 'medical store', 'cosmetics shop',
      'perfume shop', 'beauty products store',
    ],
  },
  {
    id: 'personal-services',
    name: 'Personal Services',
    priority: 1,
    keywords: [
      'salon', 'beauty parlour', 'beauty parlor', 'hair salon', 'spa',
      'barber shop', 'tattoo studio', 'mehndi artist', 'makeup artist',
      'grooming studio', 'nail salon', 'nail artist', 'threading salon',
      'facial clinic', 'bridal makeup', 'hair color specialist',
      'hair styling salon', 'men salon', 'unisex salon',
      'massage center', 'massage therapy', 'body massage',
      'steam bath', 'sauna', 'jacuzzi', 'spa therapy',
      'wellness spa', 'day spa', 'ayurvedic spa',
      'eyebrow studio', 'lash studio', 'waxing salon',
      'tanning studio', 'laser hair removal clinic',
      'skin care clinic', 'beauty clinic', 'cosmetology clinic',
    ],
  },
  {
    id: 'professional-services',
    name: 'Professional Services',
    priority: 3,
    keywords: [
      'chartered accountant', 'ca firm', 'accounting services',
      'lawyer office', 'legal consultancy', 'real estate agency',
      'property dealer', 'marketing agency', 'digital marketing company',
      'it company', 'software company', 'business consultancy',
      'tax consultant', 'company secretary', 'audit firm',
      'gst consultant', 'financial advisor', 'investment advisor',
      'insurance agent', 'loan agent', 'mortgage broker',
      'recruitment agency', 'placement consultant', 'hr consultancy',
      'architect firm', 'interior designer', 'construction company',
      'contractor', 'civil contractor', 'electrician',
      'plumber', 'painter', 'carpenter', 'interior decorator',
      'event management company', 'wedding planner',
      'photography studio', 'videography service', 'media production',
      'advertising agency', 'pr agency', 'content writing service',
      'seo service', 'web development company', 'app development company',
    ],
  },
  {
    id: 'transport-logistics',
    name: 'Transport & Logistics',
    priority: 2,
    keywords: [
      'taxi service', 'cab service', 'courier service', 'delivery service',
      'logistics company', 'bike rental', 'car rental',
      'transport service', 'truck rental', 'packers movers',
      'shifting service', 'cargo service', 'freight service',
      'warehouse service', 'cold storage', 'supply chain service',
      'bus service', 'travel bus', 'shuttle service',
      'ambulance service', 'hearse van', 'vehicle repair',
      'auto garage', 'car workshop', 'bike workshop',
      'towing service', 'roadside assistance', 'driving school',
    ],
  },
  {
    id: 'manufacturing-production',
    name: 'Manufacturing & Production',
    priority: 3,
    keywords: [
      'small factory', 'manufacturing unit', 'garment factory',
      'clothing manufacturing', 'food processing unit', 'furniture factory',
      'production house', 'industrial unit', 'factory',
      'packaging unit', 'printing press', 'engineering workshop',
      'steel fabrication', 'welding workshop', 'machine shop',
      'carpentry workshop', 'wood workshop', 'paper mill',
      'textile mill', 'oil mill', 'dal mill', 'flour mill',
      'ice factory', 'cold storage unit', 'agro processing unit',
      'chemical factory', 'plastic manufacturing', 'rubber manufacturing',
      'leather factory', 'tanning unit', 'pottery workshop',
      'ceramic factory', 'brick kiln', 'lime factory',
    ],
  },
  {
    id: 'education-training',
    name: 'Education & Training',
    priority: 2,
    keywords: [
      'school', 'coaching class', 'tuition center', 'training institute',
      'computer institute', 'online courses', 'edtech platform',
      'skill development center', 'preschool', 'playschool',
      'montessori school', 'daycare center', 'creche',
      'nursery school', 'kindergarten', 'primary school',
      'secondary school', 'higher secondary school', 'college',
      'university', 'engineering college', 'medical college',
      'management institute', 'law college', 'commerce college',
      'arts college', 'science college', 'professional college',
      'iti institute', 'vocational training', 'polytechnic college',
      'language class', 'spoken english class', 'foreign language class',
      'computer class', 'coding class', 'programming institute',
      'math class', 'science class', 'physics class', 'chemistry class',
      'biology class', 'account class', 'competition coaching',
      'upsc coaching', 'bank coaching', 'ssc coaching', 'gate coaching',
      'cat coaching', 'gmat coaching', 'ielts coaching',
      'toefl coaching', 'pTE coaching', 'dance class',
      'music class', 'singing class', 'guitar class', 'piano class',
      'art class', 'drawing class', 'painting class', 'craft class',
      'pottery class', 'cooking class', 'personality development class',
      'soft skills training', 'leadership training', 'corporate training',
    ],
  },
  {
    id: 'repair-maintenance',
    name: 'Repair & Maintenance',
    priority: 2,
    keywords: [
      'mobile repair shop', 'phone repair service',
      'AC repair service', 'refrigerator repair', 'bike workshop',
      'car workshop', 'electrical repair service', 'appliance repair shop',
      'laptop repair', 'computer repair', 'tv repair',
      'washing machine repair', 'microwave repair', 'water purifier repair',
      'geyser repair', 'cooler repair', 'air conditioner repair',
      'car ac repair', 'bike service center', 'car service center',
      'dent paint', 'car wash', 'bike wash',
      'tyre shop', 'tyre repair', 'battery shop', 'battery repair',
      'generator repair', 'inverter repair', 'lift repair',
      'elevator maintenance', 'cctv installation', 'security system repair',
      'plumber', 'electrician', 'carpenter', 'painter',
      'roof repair', 'waterproofing service', 'pest control service',
    ],
  },
  {
    id: 'real-estate-property',
    name: 'Real Estate & Property',
    priority: 2,
    keywords: [
      'real estate agent', 'property dealer', 'real estate consultant',
      'property consultant', 'real estate broker', 'property broker',
      'real estate developer', 'builder', 'construction company',
      'property management', 'rental property', 'commercial property',
      'residential property', 'land dealer', 'plot dealer',
      'apartment dealer', 'flat dealer', 'house dealer',
      'real estate investment', 'property advisor', 'housing society',
      'property valuer', 'appraiser', 'surveyor',
    ],
  },
  {
    id: 'automotive',
    name: 'Automotive',
    priority: 2,
    keywords: [
      'car dealer', 'car showroom', 'bike showroom', 'auto dealer',
      'used car dealer', 'second hand car', 'pre owned car',
      'car sales', 'bike sales', 'scooter showroom',
      'car parts shop', 'auto parts store', 'spare parts shop',
      'tyre dealer', 'battery dealer', 'car accessories shop',
      'bike accessories shop', 'car modification shop', 'bike modification shop',
      'car rental', 'bike rental', 'self drive car',
      'auto repair shop', 'car mechanic', 'bike mechanic',
      'car electrician', 'auto electrician', 'car towing',
      'car paint shop', 'dent repair', 'car detailing',
      'car wash center', 'bike wash center',
    ],
  },
  {
    id: 'entertainment-recreation',
    name: 'Entertainment & Recreation',
    priority: 3,
    keywords: [
      'movie theater', 'cinema hall', 'multiplex', 'theatre',
      'amusement park', 'water park', 'fun park', 'theme park',
      'gaming zone', 'video game parlor', 'bowling alley',
      'pool parlor', 'snooker club', 'badminton court',
      'sports club', 'fitness club', 'swimming pool',
      'park', 'playground', 'children park', 'zoo',
      'aquarium', 'museum', 'art gallery', 'science center',
      'planetarium', 'library', 'community center', 'club house',
      'event venue', 'banquet hall', 'party hall', 'convention center',
      'open ground', 'lawn', 'garden', 'auditorium',
      'music venue', 'concert hall', 'night club', 'disco',
      'casino', 'arcade', 'fun zone', 'trampoline park',
      'laser tag', 'escape room', 'adventure park', 'sky diving',
      'paragliding', 'trekking', 'camping site',
    ],
  },
  {
    id: 'agriculture-farming',
    name: 'Agriculture & Farming',
    priority: 3,
    keywords: [
      'farm', 'agriculture farm', 'organic farm', 'dairy farm',
      'poultry farm', 'goat farm', 'cattle farm', 'fish farm',
      'fishery', 'hatchery', 'horticulture farm', 'plantation',
      'nursery', 'greenhouse', 'polyhouse', 'irrigation service',
      'tractor service', 'farming equipment', 'agriculture equipment',
      'pesticide shop', 'fertilizer shop', 'seed shop',
      'agriculture consultancy', 'soil testing lab', 'agro service center',
      'dairy', 'milk dairy', 'milk collection center', 'cold storage',
      'warehouse', 'godown', 'silo', 'grain market',
      'mandi', 'vegetable wholesaler', 'fruit wholesaler',
    ],
  },
  {
    id: 'it-technology',
    name: 'IT & Technology',
    priority: 2,
    keywords: [
      'software company', 'it company', 'web development company',
      'app development company', 'software development company',
      'it services', 'it consultancy', 'technology company',
      'tech startup', 'saas company', 'cloud service provider',
      'cybersecurity company', 'data analytics company',
      'ai company', 'machine learning company', 'blockchain company',
      'game development studio', 'ecommerce development company',
      'digital agency', 'web design company', 'ui ux design company',
      'mobile app developer', 'software developer', 'programmer',
      'it training institute', 'coding bootcamp', 'computer repair',
      'network service provider', 'laptop repair shop', 'computer shop',
      'IT hardware shop', 'software consultant', 'ERP consultant',
    ],
  },
  {
    id: 'beauty-wellness',
    name: 'Beauty & Wellness',
    priority: 1,
    keywords: [
      'beauty parlour', 'beauty parlor', 'salon', 'hair salon',
      'spa', 'wellness center', 'yoga studio', 'massage center',
      'nail salon', 'makeup artist', 'bridal makeup', 'mehndi artist',
      'hair stylist', 'barber', 'barber shop', 'threading salon',
      'waxing salon', 'facial clinic', 'skin care clinic',
      'laser clinic', 'hair transplant clinic', 'cosmetic clinic',
      'beauty clinic', 'aesthetic clinic', 'dermatology clinic',
      'nutritionist', 'dietitian', 'health coach', 'wellness coach',
      'meditation center', 'spa therapy', 'ayurveda center',
      'naturopathy center', 'acupuncture clinic', 'reflexology center',
    ],
  },
];

const KEYWORD_TO_GROUP_MAP: Map<string, CategoryGroup> = new Map();
const PRIORITY_ORDER: CategoryGroup[] = [...CATEGORY_GROUPS].sort((a, b) => a.priority - b.priority);

function buildIndex(): void {
  for (const group of CATEGORY_GROUPS) {
    for (const keyword of group.keywords) {
      if (!KEYWORD_TO_GROUP_MAP.has(keyword)) {
        KEYWORD_TO_GROUP_MAP.set(keyword, group);
      }
    }
  }
}

buildIndex();

function normalizeKeyword(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const wordsA = a.split(' ');
  const wordsB = b.split(' ');

  if (wordsA.length === 1 || wordsB.length === 1) {
    if (wordsA.some(w => wordsB.includes(w))) return 0.6;
    return 0;
  }

  const commonWords = wordsA.filter(w => wordsB.includes(w));
  const maxLen = Math.max(wordsA.length, wordsB.length);
  if (maxLen === 0) return 0;

  return commonWords.length / maxLen;
}

function findMatchingGroup(input: string): CategoryGroup | null {
  const normalized = normalizeKeyword(input);

  const exactMatch = KEYWORD_TO_GROUP_MAP.get(normalized);
  if (exactMatch) return exactMatch;

  for (const [keyword, group] of KEYWORD_TO_GROUP_MAP) {
    if (keyword.includes(normalized) || normalized.includes(keyword)) {
      return group;
    }
  }

  let bestGroup: CategoryGroup | null = null;
  let bestScore = 0;

  for (const group of CATEGORY_GROUPS) {
    for (const keyword of group.keywords) {
      const score = calculateSimilarity(normalized, keyword);
      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }
  }

  if (bestScore >= 0.5) return bestGroup;

  return null;
}

export function expandKeyword(input: string): ExpandedKeyword[] {
  const normalized = normalizeKeyword(input);

  const matchedGroup = findMatchingGroup(normalized);

  if (!matchedGroup) {
    return [{
      keyword: input,
      originalQuery: input,
      categoryGroupId: 'unknown',
      categoryGroupName: 'Unknown',
      priority: 5,
      isPrimary: true,
    }];
  }

  const result: ExpandedKeyword[] = [];

  for (const keyword of matchedGroup.keywords) {
    const isPrimary = normalizeKeyword(keyword) === normalized;

    result.push({
      keyword,
      originalQuery: input,
      categoryGroupId: matchedGroup.id,
      categoryGroupName: matchedGroup.name,
      priority: isPrimary ? 1 : matchedGroup.priority,
      isPrimary,
    });
  }

  result.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.priority - b.priority;
  });

  return result;
}

export function getCategoryGroup(input: string): CategoryGroup | null {
  const normalized = normalizeKeyword(input);
  if (normalized.length === 0) return null;

  const exactMatch = KEYWORD_TO_GROUP_MAP.get(normalized);
  if (exactMatch) return exactMatch;

  return findMatchingGroup(normalized);
}

export function getAllCategoryGroups(): CategoryGroup[] {
  return CATEGORY_GROUPS;
}

export function getCategoryGroupsByPriority(ascending = true): CategoryGroup[] {
  return ascending ? PRIORITY_ORDER : [...PRIORITY_ORDER].reverse();
}

export function findAISemanticMatch(input: string): string[] {
  const normalized = normalizeKeyword(input);

  const candidates: Array<{ keyword: string; score: number; groupId: string }> = [];

  for (const group of CATEGORY_GROUPS) {
    for (const keyword of group.keywords) {
      const score = calculateSimilarity(normalized, keyword);
      if (score > 0) {
        candidates.push({ keyword, score, groupId: group.id });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const topGroupIds = new Set(candidates.slice(0, 3).map(c => c.groupId));

  const results: string[] = [];
  for (const group of CATEGORY_GROUPS) {
    if (topGroupIds.has(group.id)) {
      for (const keyword of group.keywords) {
        if (!results.includes(keyword)) {
          results.push(keyword);
        }
      }
    }
  }

  return results;
}

export const businessCategoryEngine = {
  expandKeyword,
  getCategoryGroup,
  getAllCategoryGroups,
  getCategoryGroupsByPriority,
  findAISemanticMatch,
};
