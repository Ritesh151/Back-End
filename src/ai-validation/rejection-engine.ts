export interface RejectionResult {
  rejected: boolean;
  reason: string | undefined;
  rejectionCode: RejectionCode;
}

export type RejectionCode =
  | 'IRRELEVANT_BUSINESS'
  | 'LOW_CONFIDENCE'
  | 'LOW_LOCATION_CONFIDENCE'
  | 'NEGATIVE_MATCH'
  | 'AMBIGUOUS_CATEGORY'
  | 'NO_CONTACT_INFO'
  | 'THRESHOLD_NOT_MET'
  | 'NOT_REJECTED';

export interface RejectionConfig {
  minRelevanceScore: number;
  minFinalConfidence: number;
  minLocationConfidence: number;
  rejectOnNegativeMatch: boolean;
  rejectWithoutContact: boolean;
}

const DEFAULT_CONFIG: RejectionConfig = {
  minRelevanceScore: 20,
  minFinalConfidence: 25,
  minLocationConfidence: 10,
  rejectOnNegativeMatch: true,
  rejectWithoutContact: false,
};

export class RejectionEngine {
  private config: RejectionConfig;

  constructor(config?: Partial<RejectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(params: {
    relevanceScore: number;
    finalConfidence: number;
    locationConfidence: number;
    categoryConfidence: number;
    negativeMatch: boolean;
    hasWebsite: boolean;
    hasPhone: boolean;
    hasEmail: boolean;
    ambiguityWarnings?: string[];
  }): RejectionResult {
    if (params.negativeMatch && this.config.rejectOnNegativeMatch) {
      return {
        rejected: true,
        reason: 'Business matches negative patterns (unrelated business type)',
        rejectionCode: 'NEGATIVE_MATCH',
      };
    }

    if (params.relevanceScore < this.config.minRelevanceScore) {
      return {
        rejected: true,
        reason: `Relevance score ${params.relevanceScore} is below minimum ${this.config.minRelevanceScore}`,
        rejectionCode: 'IRRELEVANT_BUSINESS',
      };
    }

    if (params.finalConfidence < this.config.minFinalConfidence) {
      return {
        rejected: true,
        reason: `Confidence score ${params.finalConfidence} is below minimum ${this.config.minFinalConfidence}`,
        rejectionCode: 'LOW_CONFIDENCE',
      };
    }

    if (params.locationConfidence < this.config.minLocationConfidence) {
      return {
        rejected: true,
        reason: `Location confidence ${params.locationConfidence} is below minimum ${this.config.minLocationConfidence}`,
        rejectionCode: 'LOW_LOCATION_CONFIDENCE',
      };
    }

    if (this.config.rejectWithoutContact &&
        !params.hasWebsite && !params.hasPhone && !params.hasEmail) {
      return {
        rejected: true,
        reason: 'Lead has no contact information (website, phone, or email)',
        rejectionCode: 'NO_CONTACT_INFO',
      };
    }

    if (params.ambiguityWarnings && params.ambiguityWarnings.length > 0 &&
        params.categoryConfidence < 30) {
      return {
        rejected: true,
        reason: `Ambiguous category with low confidence: ${params.ambiguityWarnings.join('; ')}`,
        rejectionCode: 'AMBIGUOUS_CATEGORY',
      };
    }

    return {
      rejected: false,
      reason: undefined,
      rejectionCode: 'NOT_REJECTED',
    };
  }

  updateConfig(config: Partial<RejectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RejectionConfig {
    return { ...this.config };
  }
}

export const rejectionEngine = new RejectionEngine();
