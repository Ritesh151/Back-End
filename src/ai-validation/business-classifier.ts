import { keywordIntelligence, type BusinessTypeGroup } from './keyword-intelligence';

export interface ClassificationResult {
  detectedCategory: string;
  detectedGroup: string | null;
  confidence: number;
  allPossibleCategories: Array<{ category: string; confidence: number }>;
  isHomophone: boolean;
  ambiguityWarnings: string[];
}

export class BusinessClassifier {
  classify(
    companyName: string,
    category: string | undefined,
    preferredBusinessType?: string
  ): ClassificationResult {
    const lowerName = companyName.toLowerCase().trim();
    const lowerCategory = (category || '').toLowerCase().trim();
    const text = `${lowerName} ${lowerCategory}`;

    const scored: Array<{ group: BusinessTypeGroup; score: number }> = [];
    for (const group of keywordIntelligence.getAllGroups()) {
      let score = 0;

      if (lowerName.includes(group.primary)) score += 30;
      if (lowerCategory.includes(group.primary)) score += 20;

      for (const alias of group.aliases) {
        if (lowerName.includes(alias)) { score += 25; break; }
        if (lowerCategory.includes(alias)) { score += 15; break; }
      }

      for (const term of group.relatedTerms) {
        if (lowerName.includes(term)) score += 8;
        if (lowerCategory.includes(term)) score += 5;
      }

      for (const kw of group.categoryKeywords) {
        if (text.includes(kw)) score += 10;
      }

      if (score > 0) scored.push({ group, score });
    }

    scored.sort((a, b) => b.score - a.score);

    const ambiguityWarnings: string[] = [];
    const allPossibleCategories = scored.map(s => ({
      category: s.group.primary,
      confidence: Math.min(100, Math.round((s.score / Math.max(scored[0]?.score || 1, 1)) * 100)),
    }));

    if (scored.length > 1 && scored[0].score - scored[1].score < 15) {
      ambiguityWarnings.push(
        `Ambiguous classification: could be "${scored[0].group.primary}" or "${scored[1].group.primary}"`
      );
    }

    let detectedCategory: string;
    let detectedGroup: string | null;
    let confidence: number;

    if (scored.length === 0) {
      detectedCategory = lowerCategory || lowerName || 'unknown';
      detectedGroup = null;
      confidence = 0;
    } else {
      const best = scored[0];
      if (lowerName.includes(best.group.primary) || lowerCategory.includes(best.group.primary)) {
        confidence = 90;
      } else if (scored.length > 1 && scored[0].score - scored[1].score < 10) {
        confidence = 55;
        ambiguityWarnings.push('Low confidence: multiple categories match similarly');
      } else {
        confidence = Math.min(85, Math.round((best.score / 100) * 85));
      }

      detectedCategory = best.group.primary;
      detectedGroup = best.group.primary;

      if (preferredBusinessType && detectedGroup !== preferredBusinessType.toLowerCase().trim()) {
        const preferredGroup = keywordIntelligence.getGroup(preferredBusinessType);
        if (preferredGroup) {
          const preferredScore = scored.find(s => s.group.primary === preferredGroup.primary);
          if (preferredScore && preferredScore.score > 0) {
            detectedCategory = preferredGroup.primary;
            detectedGroup = preferredGroup.primary;
            confidence = Math.min(95, confidence + 10);
          } else {
            confidence = Math.max(10, confidence - 20);
            ambiguityWarnings.push(
              `Detected as "${detectedGroup}" but searching for "${preferredBusinessType}"`
            );
          }
        }
      }
    }

    const isHomophone = ambiguityWarnings.length > 0 && scored.length > 1;

    return {
      detectedCategory,
      detectedGroup,
      confidence: Math.min(100, Math.max(0, confidence)),
      allPossibleCategories,
      isHomophone,
      ambiguityWarnings,
    };
  }
}

export const businessClassifier = new BusinessClassifier();
