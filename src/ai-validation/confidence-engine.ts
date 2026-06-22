export interface ConfidenceInput {
  relevanceScore: number;
  categoryConfidence: number;
  locationConfidence: number;
  sourceTrustScore: number;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  ratingScore: number;
  negativeMatch: boolean;
  matchType: 'exact' | 'alias' | 'related' | 'fuzzy' | 'none';
}

export interface ConfidenceResult {
  finalConfidence: number;
  relevanceScore: number;
  categoryConfidence: number;
  locationConfidence: number;
  sourceTrustScore: number;
  contactCompleteness: number;
  breakdown: {
    relevanceWeight: number;
    categoryWeight: number;
    locationWeight: number;
    sourceWeight: number;
    contactWeight: number;
    ratingWeight: number;
  };
  level: 'high' | 'medium' | 'low';
}

const WEIGHTS = {
  RELEVANCE: 0.30,
  CATEGORY: 0.20,
  LOCATION: 0.20,
  SOURCE: 0.12,
  CONTACT: 0.10,
  RATING: 0.08,
};

const SOURCE_TRUST: Record<string, number> = {
  'google-maps': 95,
  'justdial': 88,
  'indiamart': 82,
  'clutch': 80,
  'linkedin': 90,
  'directory': 70,
  'website': 60,
  'manual': 85,
};

export class ConfidenceEngine {
  calculate(input: ConfidenceInput, sourceName?: string): ConfidenceResult {
    const sourceTrustScore = sourceName
      ? SOURCE_TRUST[sourceName] ?? 75
      : input.sourceTrustScore || 75;

    const hasAnyContact = input.hasPhone || input.hasEmail;
    const contactCompleteness = this.calculateContactCompleteness(input);

    const relevanceComponent = input.relevanceScore * WEIGHTS.RELEVANCE;
    const categoryComponent = input.categoryConfidence * WEIGHTS.CATEGORY;
    const locationComponent = input.locationConfidence * WEIGHTS.LOCATION;
    const sourceComponent = sourceTrustScore * WEIGHTS.SOURCE;
    const contactComponent = contactCompleteness * WEIGHTS.CONTACT;
    const ratingComponent = input.ratingScore * WEIGHTS.RATING;

    let finalConfidence = Math.round(
      relevanceComponent + categoryComponent + locationComponent +
      sourceComponent + contactComponent + ratingComponent
    );

    if (input.negativeMatch) {
      finalConfidence = Math.min(finalConfidence, 15);
    }

    if (input.matchType === 'exact') {
      finalConfidence = Math.min(100, finalConfidence + 10);
    } else if (input.matchType === 'none') {
      finalConfidence = Math.max(0, finalConfidence - 20);
    }

    if (!hasAnyContact && finalConfidence > 50) {
      finalConfidence = Math.round(finalConfidence * 0.8);
    }

    if (!input.hasWebsite && finalConfidence > 40) {
      finalConfidence = Math.round(finalConfidence * 0.9);
    }

    if (input.locationConfidence < 20 && finalConfidence > 30) {
      finalConfidence = Math.round(finalConfidence * 0.85);
    }

    finalConfidence = Math.min(100, Math.max(0, finalConfidence));

    let level: ConfidenceResult['level'];
    if (finalConfidence >= 70) level = 'high';
    else if (finalConfidence >= 40) level = 'medium';
    else level = 'low';

    return {
      finalConfidence,
      relevanceScore: input.relevanceScore,
      categoryConfidence: input.categoryConfidence,
      locationConfidence: input.locationConfidence,
      sourceTrustScore,
      contactCompleteness,
      breakdown: {
        relevanceWeight: Math.round(relevanceComponent),
        categoryWeight: Math.round(categoryComponent),
        locationWeight: Math.round(locationComponent),
        sourceWeight: Math.round(sourceComponent),
        contactWeight: Math.round(contactComponent),
        ratingWeight: Math.round(ratingComponent),
      },
      level,
    };
  }

  private calculateContactCompleteness(input: ConfidenceInput): number {
    let score = 0;
    if (input.hasWebsite) score += 35;
    if (input.hasPhone) score += 30;
    if (input.hasEmail) score += 35;
    return score;
  }

  getSourceTrustScore(sourceName: string): number {
    return SOURCE_TRUST[sourceName] ?? 75;
  }
}

export const confidenceEngine = new ConfidenceEngine();
