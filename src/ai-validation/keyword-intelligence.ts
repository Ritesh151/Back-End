export interface BusinessTypeGroup {
  primary: string;
  aliases: string[];
  relatedTerms: string[];
  negativePatterns: string[];
  categoryKeywords: string[];
}

const BUSINESS_TYPE_GROUPS: Record<string, BusinessTypeGroup> = {
  salon: {
    primary: 'salon',
    aliases: ['salon', 'beauty parlour', 'beauty parlor', 'hair salon', 'beauty salon', 'unisex salon'],
    relatedTerms: [
      'haircut', 'hair styling', 'hair colour', 'hair color', 'hair dye', 'hairstyle',
      'makeup', 'bridal makeup', 'facial', 'manicure', 'pedicure', 'nail art',
      'spa', 'massage', 'threading', 'waxing', 'bleach', 'detan',
      'skin care', 'skin treatment', 'beauty treatment', 'cosmetology',
      'barber', 'barbershop', 'grooming', 'hair dresser', 'stylist',
      'beauty clinic', 'cosmetic clinic', 'laser hair removal',
      'hair studio', 'beauty studio', 'nail salon', 'nail studio',
    ],
    negativePatterns: [
      'gym', 'fitness', 'restaurant', 'hotel', 'hospital', 'clinic',
      'grocery', 'school', 'college', 'temple', 'bank', 'atm',
      'petrol', 'gas station', 'pharmacy', 'medical store',
      'advocate', 'lawyer', 'legal', 'chartered accountant',
    ],
    categoryKeywords: ['beauty', 'salon', 'spa', 'wellness', 'personal care'],
  },
  gym: {
    primary: 'gym',
    aliases: ['gym', 'fitness center', 'fitness', 'yoga', 'yoga center', 'yoga studio'],
    relatedTerms: [],
    negativePatterns: [
      'salon', 'beauty', 'restaurant', 'hotel', 'hospital', 'grocery',
      'school', 'college', 'temple', 'bank', 'pharmacy',
      'chartered accountant', 'advocate', 'lawyer',
      'gymnastic', 'martial arts', 'boxing',
    ],
    categoryKeywords: ['fitness', 'health', 'wellness', 'sports', 'exercise'],
  },
  restaurant: {
    primary: 'restaurant',
    aliases: ['restaurant', 'hotel restaurant', 'dining', 'eatery'],
    relatedTerms: [
      'cafe', 'café', 'coffee shop', 'bistro', 'pizzeria', 'deli',
      'fine dining', 'fast food', 'casual dining', 'multicuisine',
      'multi cuisine', 'family restaurant', 'veg restaurant',
      'non veg restaurant', 'seafood', 'bbq', 'grill',
      'food court', 'food truck', 'takeaway', 'take out',
      'delivery', 'dine in', 'cuisine', 'continental',
      'north indian', 'south indian', 'chinese', 'italian',
      'thai', 'mexican', 'bakery', 'confectionery',
      'snacks', 'quick bites', 'tiffin service', 'catering',
    ],
    negativePatterns: [
      'gym', 'salon', 'hospital', 'school', 'college', 'temple',
      'bank', 'pharmacy', 'grocery', 'hardware', 'electronics',
    ],
    categoryKeywords: ['food', 'dining', 'restaurant', 'cafe', 'cuisine', 'bakery'],
  },
  'grocery store': {
    primary: 'grocery store',
    aliases: ['grocery', 'grocery store', 'supermarket', 'kirana store', 'provision store'],
    relatedTerms: [
      'fresh produce', 'vegetable market', 'fruit shop', 'green grocer',
      'food market', 'general store', 'departmental store',
      'daily needs', 'household items', 'provisions',
      'organic store', 'organic food', 'milk booth', 'dairy',
      'confectionery', 'bakery', 'dry fruits', 'spices',
      'rice shop', 'flour mill', 'ration shop',
      'wholesale grocery', 'cash and carry', 'mart',
    ],
    negativePatterns: [
      'gym', 'salon', 'restaurant', 'hospital', 'school', 'college',
      'bank', 'atm', 'petrol', 'pharmacy', 'electronics', 'clothing',
    ],
    categoryKeywords: ['grocery', 'supermarket', 'food', 'household', 'daily needs'],
  },
  dentist: {
    primary: 'dentist',
    aliases: ['dentist', 'dental clinic', 'dentist clinic', 'dental care', 'dental office'],
    relatedTerms: [
      'orthodontist', 'periodontist', 'endodontist', 'oral surgeon',
      'pediatric dentist', 'cosmetic dentist', 'family dentist',
      'root canal', 'teeth whitening', 'dental implant',
      'dental crown', 'dental bridge', 'dental filling',
      'tooth extraction', 'dental surgery', 'oral health',
      'teeth cleaning', 'dental checkup', 'dental braces',
      'invisalign', 'denture', 'dental hygiene',
      'oral care', 'dental treatment', 'smile design',
      'dental hospital', 'dental surgeon',
    ],
    negativePatterns: [
      'gym', 'salon', 'restaurant', 'hospital', 'grocery', 'school',
      'college', 'temple', 'bank', 'pharmacy', 'general physician',
      'ayurvedic', 'homeopathy', 'skin clinic',
    ],
    categoryKeywords: ['dental', 'dentistry', 'oral care', 'healthcare'],
  },
  'software company': {
    primary: 'software company',
    aliases: ['software company', 'software firm', 'it company', 'tech company', 'software development'],
    relatedTerms: [
      'web development', 'app development', 'mobile app development',
      'software development', 'custom software', 'saas',
      'it services', 'it consulting', 'digital agency',
      'web design', 'ui ux design', 'graphic design',
      'digital marketing', 'seo', 'social media marketing',
      'ecommerce development', 'wordpress development',
      'crm development', 'erp solutions', 'cloud solutions',
      'data analytics', 'ai development', 'machine learning',
      'blockchain', 'iot', 'cybersecurity', 'software solutions',
      'technology solutions', 'it solutions', 'digital solutions',
      'programming', 'coding', 'software engineering',
      'product development', 'startup', 'technology consulting',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'college', 'bank', 'pharmacy', 'hardware shop', 'clothing',
    ],
    categoryKeywords: ['technology', 'software', 'it', 'digital', 'development'],
  },
  'mobile shop': {
    primary: 'mobile shop',
    aliases: ['mobile shop', 'mobile store', 'phone shop', 'mobile phone store'],
    relatedTerms: [
      'smartphone', 'mobile phone', 'cell phone', 'mobile repair',
      'phone repair', 'mobile accessories', 'phone accessories',
      'mobile cover', 'screen repair', 'mobile service center',
      'mobile dealer', 'mobile retailer', 'telecom shop',
      'sim card', 'mobile recharge', 'gadget shop',
      'electronics mobile', 'mobile showroom',
      'apple service', 'samsung service', 'xiaomi service',
      'mobile parts', 'tablet repair', 'laptop repair',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy', 'clothing', 'hardware', 'electronics repair', 'tv repair',
    ],
    categoryKeywords: ['mobile', 'phone', 'telecom', 'gadget', 'electronics'],
  },
  hospital: {
    primary: 'hospital',
    aliases: ['hospital', 'medical center', 'healthcare center', 'nursing home', 'multi-specialty hospital'],
    relatedTerms: [
      'clinic', 'medical clinic', 'health center', 'wellness center',
      'general hospital', 'super speciality', 'multi speciality',
      'emergency care', 'icu', 'surgery', 'diagnostic center',
      'pathology lab', 'radiology', 'medical imaging',
      'cardiology', 'neurology', 'orthopedic', 'pediatrics',
      'gynecology', 'dermatology', 'ophthalmology', 'ent',
      'general medicine', 'physician', 'surgeon', 'doctor',
      'healthcare', 'medical care', 'treatment',
      'blood bank', 'ambulance', 'pharmacy',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'grocery', 'school', 'college',
      'temple', 'bank', 'advocate', 'chartered accountant',
      'hardware', 'electronics', 'clothing',
    ],
    categoryKeywords: ['healthcare', 'medical', 'hospital', 'treatment', 'health'],
  },
  'real estate': {
    primary: 'real estate',
    aliases: ['real estate', 'real estate agent', 'property dealer', 'realtor', 'real estate consultant'],
    relatedTerms: [
      'property consultant', 'property agent', 'real estate broker',
      'property advisor', 'realty', 'realestate',
      'builder', 'developer', 'construction company',
      'property management', 'property investment',
      'commercial property', 'residential property',
      'land developer', 'property valuation',
      'home loans', 'housing', 'apartment', 'villa',
      'plot', 'land', 'real estate developer',
      'property dealer', 'real estate services',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy', 'clothing', 'mobile shop',
    ],
    categoryKeywords: ['real estate', 'property', 'construction', 'housing'],
  },
  'interior designer': {
    primary: 'interior designer',
    aliases: ['interior designer', 'interior design', 'interior decorator', 'home interior'],
    relatedTerms: [
      'interior decoration', 'home decor', 'office interior',
      'commercial interior', 'residential interior',
      'modular kitchen', 'wardrobe design', 'furniture design',
      'space planning', 'architectural design',
      'false ceiling', 'flooring', 'wallpaper', 'painting',
      'lighting design', 'home renovation', 'office renovation',
      'turnkey interior', 'interior consultant',
      'home styling', 'property styling', 'interior solutions',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy', 'bank', 'advocate',
    ],
    categoryKeywords: ['interior', 'design', 'decor', 'furniture', 'renovation'],
  },
  cafe: {
    primary: 'cafe',
    aliases: ['cafe', 'café', 'coffee shop', 'coffee house', 'coffee bar'],
    relatedTerms: [
      'coffee', 'espresso', 'cappuccino', 'latte', 'cold coffee',
      'tea', 'chai', 'beverage', 'smoothie', 'juice bar',
      'snacks', 'sandwich', 'pastry', 'cake', 'dessert',
      'bakery', 'patisserie', 'confectionery',
      'breakfast', 'brunch', 'fast food',
      'rooftop cafe', 'cafe restaurant', 'bistro',
      'internet cafe', 'cyber cafe', 'hookah cafe',
      'coffee roaster', 'specialty coffee',
    ],
    negativePatterns: [
      'gym', 'salon', 'hospital', 'grocery', 'school', 'college',
      'temple', 'bank', 'pharmacy', 'hardware', 'electronics',
      'full restaurant', 'fine dining',
    ],
    categoryKeywords: ['cafe', 'coffee', 'beverage', 'snacks', 'bakery'],
  },
  architect: {
    primary: 'architect',
    aliases: ['architect', 'architecture firm', 'architect studio', 'architectural firm'],
    relatedTerms: [
      'architecture', 'architectural design', 'building design',
      'landscape architect', 'urban design', 'town planning',
      'architectural consultancy', 'architectural services',
      'building planner', 'structural design', '3d design',
      'architectural visualization', 'cad design',
      'drafting', 'architectural drawing', 'building architecture',
      'residential architect', 'commercial architect',
      'interior architecture', 'architectural engineer',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy', 'bank', 'advocate', 'interior designer',
    ],
    categoryKeywords: ['architect', 'architecture', 'design', 'building'],
  },
  'ca office': {
    primary: 'ca office',
    aliases: ['chartered accountant', 'ca firm', 'ca office', 'accountant'],
    relatedTerms: [
      'audit', 'taxation', 'tax consultant', 'tax advisor',
      'accounting firm', 'accounting services',
      'gst consultant', 'income tax', 'tax filing',
      'financial consultant', 'financial advisor',
      'bookkeeping', 'payroll services',
      'company registration', 'business registration',
      'audit firm', 'auditor', 'chartered accountancy',
      'cost accountant', 'company secretary', 'cs',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'college', 'temple', 'bank', 'advocate', 'lawyer',
    ],
    categoryKeywords: ['accounting', 'taxation', 'audit', 'finance', 'consulting'],
  },
  manufacturer: {
    primary: 'manufacturer',
    aliases: ['manufacturer', 'manufacturing company', 'factory', 'production unit'],
    relatedTerms: [
      'industrial', 'production', 'processing unit', 'fabrication',
      'assembly', 'packaging', 'manufacturing unit',
      'original equipment manufacturer', 'oem',
      'precision engineering', 'machine shop',
      'tool room', 'die casting', 'injection moulding',
      'textile mill', 'steel plant', 'chemical plant',
      'food processing', 'beverage manufacturing',
      'pharmaceutical manufacturing', 'electronics manufacturing',
      'automobile manufacturing', 'furniture manufacturing',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy retail', 'clothing store', 'mobile shop',
    ],
    categoryKeywords: ['manufacturing', 'industrial', 'production', 'factory'],
  },
  supplier: {
    primary: 'supplier',
    aliases: ['supplier', 'wholesaler', 'distributor', 'trader', 'stockist'],
    relatedTerms: [
      'wholesale', 'wholesale dealer', 'bulk supplier',
      'importer', 'exporter', 'merchant',
      'vendor', 'dealer', 'retailer wholesale',
      'raw material supplier', 'industrial supplier',
      'construction material supplier', 'building material supplier',
      'electrical supplier', 'plumbing supplier',
      'stationery supplier', 'office supplies',
      'food supplier', 'beverage supplier',
      'chemical supplier', 'packaging supplier',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery retail',
      'school', 'pharmacy retail', 'clothing retail',
    ],
    categoryKeywords: ['supply', 'wholesale', 'distribution', 'trade'],
  },
  'hardware shop': {
    primary: 'hardware shop',
    aliases: ['hardware shop', 'hardware store', 'iron shop', 'hardware mart'],
    relatedTerms: [
      'building material', 'construction material', 'paint shop',
      'paint store', 'sanitaryware', 'plumbing material',
      'electrical shop', 'electrical goods', 'tools',
      'power tools', 'hand tools', 'nuts bolts',
      'plywood', 'laminates', 'flooring material',
      'cement', 'steel', 'tiles', 'marble', 'granite',
      'glass shop', 'aluminium', 'hardware products',
      'door locks', 'pipes', 'fittings', 'bathroom fittings',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy', 'clothing', 'mobile shop', 'electronics',
    ],
    categoryKeywords: ['hardware', 'building material', 'construction', 'tools'],
  },
  boutique: {
    primary: 'boutique',
    aliases: ['boutique', 'fashion boutique', 'designer boutique', 'clothing boutique'],
    relatedTerms: [
      'fashion designer', 'designer wear', 'ethnic wear',
      'traditional wear', 'bridal wear', 'party wear',
      'western wear', 'indo western', 'casual wear',
      'women fashion', 'women clothing', 'ladies wear',
      'gents wear', 'men fashion', 'kids wear',
      'custom tailoring', 'custom dress', 'bespoke tailoring',
      'stitching', 'alterations', 'embroidery',
      'lehenga', 'saree', 'salwar', 'kurta', 'sherwani',
      'designer boutique', 'fashion studio', 'style studio',
    ],
    negativePatterns: [
      'gym', 'restaurant', 'hospital', 'grocery', 'school', 'college',
      'bank', 'pharmacy', 'electronics', 'hardware',
    ],
    categoryKeywords: ['fashion', 'clothing', 'designer', 'boutique', 'apparel'],
  },
  'wedding planner': {
    primary: 'wedding planner',
    aliases: ['wedding planner', 'event planner', 'wedding organizer', 'wedding consultant'],
    relatedTerms: [
      'event management', 'event organizer', 'celebration',
      'marriage', 'wedding', 'engagement', 'reception',
      'wedding decoration', 'destination wedding',
      'wedding photography', 'wedding cinematography',
      'wedding catering', 'wedding venue',
      'wedding card', 'invitation', 'mehendi',
      'sangeet', 'haldi', 'wedding makeup',
      'wedding choreography', 'wedding entertainment',
      'corporate event', 'birthday party', 'party planner',
    ],
    negativePatterns: [
      'gym', 'salon', 'hospital', 'grocery', 'school', 'college',
      'bank', 'pharmacy', 'hardware', 'electronics',
    ],
    categoryKeywords: ['events', 'wedding', 'celebration', 'management'],
  },
  'electronics shop': {
    primary: 'electronics shop',
    aliases: ['electronics shop', 'electronic store', 'electrical shop', 'appliance store'],
    relatedTerms: [
      'home appliance', 'tv', 'television', 'ac', 'air conditioner',
      'refrigerator', 'fridge', 'washing machine', 'microwave',
      'oven', 'mixer grinder', 'water purifier',
      'laptop', 'computer', 'desktop', 'printer',
      'speaker', 'headphone', 'earphone', 'smartwatch',
      'cctv', 'security camera', 'home theatre',
      'kitchen appliance', 'electrical appliance',
      'electronic goods', 'gadget store', 'electronics repair',
    ],
    negativePatterns: [
      'salon', 'gym', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy', 'clothing', 'hardware', 'mobile shop',
    ],
    categoryKeywords: ['electronics', 'appliances', 'gadgets', 'electrical'],
  },
  'clothing store': {
    primary: 'clothing store',
    aliases: ['clothing store', 'garment shop', 'apparel store', 'readymade garments', 'fashion store'],
    relatedTerms: [
      'fashion', 'apparel', 'garment', 'dress', 'wear',
      'cloth shop', 'textile shop', 'fabric shop',
      'suits', 'shirts', 't shirts', 'jeans', 'trousers',
      'ethnic wear', 'traditional', 'casual wear',
      'formal wear', 'sportswear', 'activewear',
      'women clothing', 'men clothing', 'kids clothing',
      'lingerie', 'innerwear', 'nightwear',
      'uniform', 'school uniform', 'corporate uniform',
      'wholesale clothing', 'garment manufacturer',
    ],
    negativePatterns: [
      'gym', 'salon', 'restaurant', 'hospital', 'grocery', 'school',
      'pharmacy', 'electronics', 'hardware', 'mobile shop',
    ],
    categoryKeywords: ['clothing', 'fashion', 'apparel', 'garments', 'textile'],
  },
};

export class KeywordIntelligence {
  getGroup(businessType: string): BusinessTypeGroup | undefined {
    const lower = businessType.toLowerCase().trim();
    if (BUSINESS_TYPE_GROUPS[lower]) return BUSINESS_TYPE_GROUPS[lower];
    for (const group of Object.values(BUSINESS_TYPE_GROUPS)) {
      for (const alias of group.aliases) {
        if (lower === alias || lower.includes(alias)) return group;
      }
    }
    for (const group of Object.values(BUSINESS_TYPE_GROUPS)) {
      if (lower.includes(group.primary)) return group;
    }
    return undefined;
  }

  getAllGroups(): BusinessTypeGroup[] {
    return Object.values(BUSINESS_TYPE_GROUPS);
  }

  matchAgainstGroup(companyName: string, category: string | undefined, businessType: string): {
    matched: boolean;
    score: number;
    matchedTerms: string[];
    matchedCategory: string;
    negativeMatch: boolean;
  } {
    const lowerName = companyName.toLowerCase().trim();
    const lowerCategory = (category || '').toLowerCase().trim();
    const group = this.getGroup(businessType);

    if (!group) {
      return this.fallbackMatch(lowerName, lowerCategory, businessType);
    }

    const matchedTerms: string[] = [];
    let score = 0;
    let negativeMatch = false;

    if (lowerName.includes(group.primary)) {
      score += 40;
      matchedTerms.push(group.primary);
    }
    if (lowerCategory.includes(group.primary)) {
      score += 30;
      matchedTerms.push(`${group.primary}(cat)`);
    }

    for (const alias of group.aliases) {
      if (lowerName.includes(alias) && alias !== group.primary) {
        score += 30;
        matchedTerms.push(alias);
        break;
      }
    }

    for (const term of group.relatedTerms) {
      if (this.fuzzyMatch(lowerName, term)) {
        score += 12;
        matchedTerms.push(term);
      }
      if (lowerCategory && this.fuzzyMatch(lowerCategory, term)) {
        score += 8;
        if (!matchedTerms.includes(term)) matchedTerms.push(term);
      }
    }

    for (const neg of group.negativePatterns) {
      if (this.fuzzyMatch(lowerName, neg)) {
        score -= 20;
        negativeMatch = true;
      }
      if (lowerCategory && this.fuzzyMatch(lowerCategory, neg)) {
        score -= 15;
        negativeMatch = true;
      }
    }

    const categoryMatch = this.classifyToCategory(lowerName, lowerCategory);
    if (categoryMatch && categoryMatch !== group.primary) {
      score -= 15;
    }

    if (lowerName.includes(group.primary)) {
      score = Math.max(score, 60);
    }

    const validatedCategory = matchedTerms.length > 0 ? matchedTerms[0] : (category || companyName);

    return {
      matched: score >= 20,
      score: Math.min(100, Math.max(0, score)),
      matchedTerms: [...new Set(matchedTerms)],
      matchedCategory: validatedCategory,
      negativeMatch,
    };
  }

  private fuzzyMatch(text: string, keyword: string): boolean {
    const t = text.toLowerCase();
    const k = keyword.toLowerCase();
    if (t.includes(k)) return true;
    if (k.length > 3 && t.includes(k.slice(0, -1))) return true;
    const tWords = t.split(/\s+/);
    const kWords = k.split(/\s+/);
    for (const kw of kWords) {
      if (kw.length < 3) continue;
      for (const tw of tWords) {
        if (tw === kw) return true;
        if (tw.length > 4 && kw.length > 4 && (tw.startsWith(kw) || kw.startsWith(tw))) return true;
      }
    }
    return false;
  }

  private classifyToCategory(companyName: string, category: string): string | null {
    const text = `${companyName} ${category}`;
    let bestGroup: string | null = null;
    let bestScore = 0;
    for (const group of Object.values(BUSINESS_TYPE_GROUPS)) {
      let score = 0;
      for (const kw of group.categoryKeywords) {
        if (text.includes(kw)) score += 10;
      }
      for (const term of group.relatedTerms) {
        if (text.includes(term)) score += 5;
      }
      if (score > bestScore) {
        bestScore = score;
        bestGroup = group.primary;
      }
    }
    return bestGroup;
  }

  private fallbackMatch(
    lowerName: string,
    lowerCategory: string,
    businessType: string
  ): {
    matched: boolean;
    score: number;
    matchedTerms: string[];
    matchedCategory: string;
    negativeMatch: boolean;
  } {
    const businessLower = businessType.toLowerCase().trim();
    const matchedTerms: string[] = [];
    let score = 0;

    if (lowerName.includes(businessLower)) {
      score += 40;
      matchedTerms.push(businessLower);
    }
    if (lowerCategory.includes(businessLower)) {
      score += 30;
      matchedTerms.push(`${businessLower}(cat)`);
    }

    const businessWords = businessLower.split(/\s+/);
    for (const word of businessWords) {
      if (word.length < 3) continue;
      if (lowerName.includes(word)) {
        score += 15;
        matchedTerms.push(word);
      }
      if (lowerCategory.includes(word)) {
        score += 10;
        if (!matchedTerms.includes(word)) matchedTerms.push(word);
      }
    }

    if (lowerName.includes(businessLower)) {
      score = Math.max(score, 50);
    }

    const validatedCategory = matchedTerms.length > 0 ? matchedTerms[0] : (lowerCategory || lowerName);

    return {
      matched: score >= 20,
      score: Math.min(100, Math.max(0, score)),
      matchedTerms: [...new Set(matchedTerms)],
      matchedCategory: validatedCategory,
      negativeMatch: false,
    };
  }

  getAllPrimaryTypes(): string[] {
    return Object.keys(BUSINESS_TYPE_GROUPS);
  }
}

export const keywordIntelligence = new KeywordIntelligence();
