export interface LocationValidationResult {
  relevant: boolean;
  locationConfidence: number;
  areaMatch: boolean;
  cityMatch: boolean;
  stateMatch: boolean;
  matchedAreas: string[];
  matchType: 'exact' | 'partial' | 'none';
  distance: 'same' | 'nearby' | 'different';
}

export class LocationValidator {
  validate(
    address: string | undefined,
    targetArea?: string,
    targetCity?: string,
    targetState?: string
  ): LocationValidationResult {
    if (!address) {
      return {
        relevant: false,
        locationConfidence: 0,
        areaMatch: false,
        cityMatch: false,
        stateMatch: false,
        matchedAreas: [],
        matchType: 'none',
        distance: 'different',
      };
    }

    const lowerAddress = address.toLowerCase().trim();
    const matchedAreas: string[] = [];
    let areaMatch = false;
    let cityMatch = false;
    let stateMatch = false;
    let score = 0;

    if (targetArea) {
      const areaLower = targetArea.toLowerCase().trim();
      if (this.exactMatch(lowerAddress, areaLower)) {
        score += 50;
        areaMatch = true;
        matchedAreas.push(areaLower);
      } else if (this.partialMatch(lowerAddress, areaLower)) {
        score += 30;
        areaMatch = true;
        matchedAreas.push(areaLower);
      } else if (this.wordMatch(lowerAddress, areaLower)) {
        score += 20;
        areaMatch = true;
        matchedAreas.push(areaLower);
      }

      const areaWords = areaLower.split(/[\s,]+/).filter(w => w.length > 2);
      for (const word of areaWords) {
        if (!areaMatch && lowerAddress.includes(word)) {
          score += 10;
          matchedAreas.push(word);
        }
      }
    }

    if (targetCity) {
      const cityLower = targetCity.toLowerCase().trim();
      if (lowerAddress.includes(cityLower)) {
        score += 20;
        cityMatch = true;
        matchedAreas.push(cityLower);
      } else {
        const cityVariants = this.generateCityVariants(cityLower);
        for (const variant of cityVariants) {
          if (lowerAddress.includes(variant)) {
            score += 15;
            cityMatch = true;
            matchedAreas.push(variant);
            break;
          }
        }
      }
    }

    if (targetState) {
      const stateLower = targetState.toLowerCase().trim();
      if (lowerAddress.includes(stateLower)) {
        score += 10;
        stateMatch = true;
        matchedAreas.push(stateLower);
      }

      const stateAbbr = this.getStateAbbreviation(targetState);
      if (stateAbbr && lowerAddress.includes(stateAbbr.toLowerCase())) {
        if (!stateMatch) score += 8;
        stateMatch = true;
      }
    }

    const pincode = this.extractPincode(lowerAddress);
    if (pincode && targetCity) {
      const pincodeCity = this.inferCityFromPincode(pincode);
      if (pincodeCity === targetCity.toLowerCase().trim()) {
        score += 15;
        cityMatch = true;
      }
    }

    if (targetArea && areaMatch) {
      score = Math.max(score, 40);
    }

    const scoreWithoutArea = targetArea ? 0 : 25;
    const locationConfidence = Math.min(100, score + scoreWithoutArea);

    let matchType: LocationValidationResult['matchType'];
    if (areaMatch && (cityMatch || stateMatch)) {
      matchType = 'exact';
    } else if (areaMatch || cityMatch) {
      matchType = 'partial';
    } else {
      matchType = 'none';
    }

    let distance: LocationValidationResult['distance'];
    if (areaMatch && targetArea) {
      distance = 'same';
    } else if (cityMatch) {
      distance = 'nearby';
    } else {
      distance = 'different';
    }

    const relevant = targetArea
      ? (areaMatch && score >= 25) || score >= 35
      : score >= 15;

    return {
      relevant,
      locationConfidence,
      areaMatch,
      cityMatch,
      stateMatch,
      matchedAreas: [...new Set(matchedAreas)],
      matchType,
      distance,
    };
  }

  private exactMatch(address: string, area: string): boolean {
    return address.includes(area);
  }

  private partialMatch(address: string, area: string): boolean {
    const areaParts = area.split(/[\s,]+/).filter(p => p.length > 2);
    const matchCount = areaParts.filter(p => address.includes(p)).length;
    return matchCount >= 2 || (areaParts.length >= 2 && matchCount >= areaParts.length - 1);
  }

  private wordMatch(address: string, area: string): boolean {
    const areaWords = area.split(/[\s,]+/).filter(w => w.length > 3);
    const addressWords = address.split(/[\s,]+/).filter(w => w.length > 2);
    for (const aw of areaWords) {
      for (const adw of addressWords) {
        if (aw === adw) return true;
        if (aw.length > 4 && adw.length > 4 && (aw.startsWith(adw) || adw.startsWith(aw))) return true;
      }
    }
    return false;
  }

  private generateCityVariants(city: string): string[] {
    const variants: string[] = [city];
    const knownAliases: Record<string, string[]> = {
      'bangalore': ['bengaluru', 'bangaluru'],
      'bengaluru': ['bangalore', 'bangaluru'],
      'mumbai': ['bombay'],
      'delhi': ['new delhi', 'old delhi'],
      'kolkata': ['calcutta'],
      'chennai': ['madras'],
      'pune': ['poona'],
      'hyderabad': ['hyd', 'secunderabad'],
      'ahmedabad': ['amdavad'],
      'kochi': ['cochin'],
      'thiruvananthapuram': ['trivandrum', 'tvm'],
      'mysore': ['mysuru'],
      'mangalore': ['mangaluru'],
      'vadodara': ['baroda'],
      'surat': ['so rat'],
      'lucknow': ['lakhnau'],
      'varanasi': ['banaras', 'kashi'],
      'amritsar': ['ambar'],
      'chandigarh': ['chd'],
      'jaipur': ['pink city'],
      'kanpur': ['cawnpore'],
      'indore': ['indaur'],
      'bhopal': ['bho pal'],
      'nagpur': ['nag'],
      'patna': ['pataliputra'],
      'guwahati': ['gauhati'],
    };
    const aliases = knownAliases[city];
    if (aliases) variants.push(...aliases);
    return variants;
  }

  private extractPincode(address: string): string | null {
    const match = address.match(/\b\d{6}\b/);
    return match ? match[0] : null;
  }

  private inferCityFromPincode(pincode: string): string | null {
    const firstDigit = parseInt(pincode[0], 10);
    if (isNaN(firstDigit)) return null;
    const pincodeCityMap: Record<number, string> = {
      1: 'delhi',
      2: 'lucknow',
      3: 'mumbai',
      4: 'mumbai',
      5: 'hyderabad',
      6: 'chennai',
      7: 'kolkata',
      8: 'patna',
      9: 'bhopal',
    };
    return pincodeCityMap[firstDigit] || null;
  }

  private getStateAbbreviation(state: string): string | null {
    const stateAbbrMap: Record<string, string> = {
      'andhra pradesh': 'AP',
      'arunachal pradesh': 'AR',
      'assam': 'AS',
      'bihar': 'BR',
      'chhattisgarh': 'CG',
      'goa': 'GA',
      'gujarat': 'GJ',
      'haryana': 'HR',
      'himachal pradesh': 'HP',
      'jharkhand': 'JH',
      'karnataka': 'KA',
      'kerala': 'KL',
      'madhya pradesh': 'MP',
      'maharashtra': 'MH',
      'manipur': 'MN',
      'meghalaya': 'ML',
      'mizoram': 'MZ',
      'nagaland': 'NL',
      'odisha': 'OD',
      'punjab': 'PB',
      'rajasthan': 'RJ',
      'sikkim': 'SK',
      'tamil nadu': 'TN',
      'telangana': 'TS',
      'tripura': 'TR',
      'uttar pradesh': 'UP',
      'uttarakhand': 'UK',
      'west bengal': 'WB',
    };
    return stateAbbrMap[state.toLowerCase().trim()] || null;
  }
}

export const locationValidator = new LocationValidator();
