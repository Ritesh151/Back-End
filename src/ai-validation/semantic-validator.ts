import { keywordIntelligence } from './keyword-intelligence';

export interface SemanticValidationResult {
  relevant: boolean;
  score: number;
  categoryConfidence: number;
  matchedKeywords: string[];
  validatedCategory: string;
  matchType: 'exact' | 'alias' | 'related' | 'fuzzy' | 'none';
  negativeMatch: boolean;
  matchedGroup: string | null;
}

export class SemanticValidator {
  validate(
    companyName: string,
    category: string | undefined,
    businessType: string
  ): SemanticValidationResult {
    const group = keywordIntelligence.getGroup(businessType);
    if (!group) {
      return this.fallback(companyName, category, businessType);
    }

    const result = keywordIntelligence.matchAgainstGroup(companyName, category, businessType);
    const lowerName = companyName.toLowerCase().trim();
    const lowerCategory = (category || '').toLowerCase().trim();
    let matchType: SemanticValidationResult['matchType'] = 'none';

    if (lowerName.includes(group.primary) || lowerCategory.includes(group.primary)) {
      matchType = 'exact';
    } else {
      for (const alias of group.aliases) {
        if (lowerName.includes(alias) || lowerCategory.includes(alias)) {
          matchType = 'alias';
          break;
        }
      }
    }

    if (matchType === 'none') {
      for (const term of group.relatedTerms) {
        if (keywordIntelligence['fuzzyMatch'](lowerName, term) ||
            (lowerCategory && keywordIntelligence['fuzzyMatch'](lowerCategory, term))) {
          matchType = 'related';
          break;
        }
      }
    }

    if (matchType === 'none' && result.matched) {
      matchType = 'fuzzy';
    }

    const categoryConfidence = this.calculateCategoryConfidence(
      result.score, matchType, result.matchedTerms.length, result.negativeMatch
    );

    return {
      relevant: result.matched && !result.negativeMatch,
      score: result.score,
      categoryConfidence,
      matchedKeywords: result.matchedTerms,
      validatedCategory: result.matchedCategory,
      matchType,
      negativeMatch: result.negativeMatch,
      matchedGroup: group.primary,
    };
  }

  private calculateCategoryConfidence(
    score: number,
    matchType: string,
    _matchedCount: number,
    negativeMatch: boolean
  ): number {
    if (negativeMatch) return 0;
    if (matchType === 'exact') return Math.min(100, score + 15);
    if (matchType === 'alias') return Math.min(100, score + 10);
    if (matchType === 'related') return Math.min(100, score + 5);
    if (matchType === 'fuzzy') return Math.min(85, score);
    return Math.min(50, score);
  }

  private fallback(
    companyName: string,
    category: string | undefined,
    businessType: string
  ): SemanticValidationResult {
    const lowerName = companyName.toLowerCase().trim();
    const lowerCategory = (category || '').toLowerCase().trim();
    const businessLower = businessType.toLowerCase().trim();
    const matchedKeywords: string[] = [];
    let score = 0;

    if (lowerName.includes(businessLower)) {
      score += 35;
      matchedKeywords.push(businessLower);
    }
    if (lowerCategory.includes(businessLower)) {
      score += 25;
      matchedKeywords.push(`${businessLower}(cat)`);
    }

    const businessWords = businessLower.split(/\s+/);
    for (const word of businessWords) {
      if (word.length < 3) continue;
      if (lowerName.includes(word)) {
        score += 10;
        matchedKeywords.push(word);
      }
      if (lowerCategory.includes(word)) {
        score += 8;
        if (!matchedKeywords.includes(word)) matchedKeywords.push(word);
      }
    }

    const matchType: SemanticValidationResult['matchType'] =
      lowerName.includes(businessLower) ? 'exact' :
      matchedKeywords.length > 0 ? 'fuzzy' : 'none';

    return {
      relevant: score >= 20,
      score: Math.min(100, Math.max(0, score)),
      categoryConfidence: score >= 60 ? 85 : score >= 40 ? 65 : score >= 20 ? 40 : 10,
      matchedKeywords: [...new Set(matchedKeywords)],
      validatedCategory: matchedKeywords.length > 0 ? matchedKeywords[0] : (category || companyName),
      matchType,
      negativeMatch: false,
      matchedGroup: null,
    };
  }
}

export const semanticValidator = new SemanticValidator();
