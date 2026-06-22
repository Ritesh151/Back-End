import { semanticValidator, type SemanticValidationResult } from './semantic-validator';
import { businessClassifier, type ClassificationResult } from './business-classifier';
import { locationValidator, type LocationValidationResult } from './location-validator';
import { confidenceEngine, type ConfidenceResult } from './confidence-engine';
import { rejectionEngine, type RejectionResult } from './rejection-engine';
import { leadQualityEngine, type LeadQualityResult } from './lead-quality-engine';
import { keywordIntelligence } from './keyword-intelligence';

export interface AIValidationInput {
  companyName: string;
  category?: string;
  businessType: string;
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  rating?: number;
  source: string;
  targetArea?: string;
  targetCity?: string;
  targetState?: string;
}

export interface AIValidationOutput {
  semanticValidation: SemanticValidationResult;
  classification: ClassificationResult;
  locationValidation: LocationValidationResult;
  confidence: ConfidenceResult;
  rejection: RejectionResult;
  quality: LeadQualityResult;
}

export class AIRelevanceService {
  validate(input: AIValidationInput): AIValidationOutput {
    const semantic = semanticValidator.validate(
      input.companyName,
      input.category,
      input.businessType
    );

    const classification = businessClassifier.classify(
      input.companyName,
      input.category,
      input.businessType
    );

    const location = locationValidator.validate(
      input.address,
      input.targetArea,
      input.targetCity,
      input.targetState
    );

    const sourceTrustScore = confidenceEngine.getSourceTrustScore(input.source);

    const confidence = confidenceEngine.calculate({
      relevanceScore: semantic.score,
      categoryConfidence: semantic.categoryConfidence,
      locationConfidence: location.locationConfidence,
      sourceTrustScore,
      hasWebsite: !!input.website,
      hasPhone: !!input.phone,
      hasEmail: !!input.email,
      ratingScore: input.rating ? (input.rating / 5) * 100 : 0,
      negativeMatch: semantic.negativeMatch,
      matchType: semantic.matchType,
    }, input.source);

    const rejection = rejectionEngine.evaluate({
      relevanceScore: semantic.score,
      finalConfidence: confidence.finalConfidence,
      locationConfidence: location.locationConfidence,
      categoryConfidence: semantic.categoryConfidence,
      negativeMatch: semantic.negativeMatch,
      hasWebsite: !!input.website,
      hasPhone: !!input.phone,
      hasEmail: !!input.email,
      ambiguityWarnings: classification.ambiguityWarnings,
    });

    const quality = leadQualityEngine.assess({
      semantic,
      classification,
      location,
      confidence,
      rejection,
    });

    return {
      semanticValidation: semantic,
      classification,
      locationValidation: location,
      confidence,
      rejection,
      quality,
    };
  }

  validateBatch(inputs: AIValidationInput[]): AIValidationOutput[] {
    return inputs.map(input => this.validate(input));
  }

  getKeywordIntelligence() {
    return keywordIntelligence;
  }

  getSemanticValidator() {
    return semanticValidator;
  }
}

export const aiRelevanceService = new AIRelevanceService();
