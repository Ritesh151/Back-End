import type { SemanticValidationResult } from './semantic-validator';
import type { ClassificationResult } from './business-classifier';
import type { LocationValidationResult } from './location-validator';
import type { ConfidenceResult } from './confidence-engine';
import type { RejectionResult } from './rejection-engine';

export interface LeadQualityResult {
  overall: {
    quality: 'excellent' | 'good' | 'average' | 'poor';
    score: number;
    isQualified: boolean;
  };
  semanticValidation: SemanticValidationResult;
  classification: ClassificationResult;
  locationValidation: LocationValidationResult;
  confidence: ConfidenceResult;
  rejection: RejectionResult;
  recommendation: 'accept' | 'review' | 'reject';
  warnings: string[];
}

export class LeadQualityEngine {
  assess(params: {
    semantic: SemanticValidationResult;
    classification: ClassificationResult;
    location: LocationValidationResult;
    confidence: ConfidenceResult;
    rejection: RejectionResult;
  }): LeadQualityResult {
    const warnings: string[] = [];

    if (!params.semantic.relevant) {
      warnings.push('Semantic validation indicates business is not relevant');
    }

    if (params.classification.ambiguityWarnings.length > 0) {
      warnings.push(...params.classification.ambiguityWarnings);
    }

    if (!params.location.relevant) {
      warnings.push('Location validation indicates area mismatch');
    }

    if (params.confidence.level === 'low') {
      warnings.push('Overall confidence is low');
    }

    if (params.classification.confidence < 50) {
      warnings.push('Category classification confidence is low');
    }

    if (params.location.distance === 'different') {
      warnings.push('Business address does not match target area');
    }

    const qualityScore = Math.round(
      params.confidence.finalConfidence * 0.40 +
      params.semantic.score * 0.25 +
      params.confidence.categoryConfidence * 0.15 +
      params.location.locationConfidence * 0.10 +
      params.confidence.contactCompleteness * 0.10
    );

    let quality: LeadQualityResult['overall']['quality'];
    if (qualityScore >= 80) quality = 'excellent';
    else if (qualityScore >= 60) quality = 'good';
    else if (qualityScore >= 40) quality = 'average';
    else quality = 'poor';

    const isQualified = !params.rejection.rejected && quality !== 'poor';

    let recommendation: LeadQualityResult['recommendation'];
    if (params.rejection.rejected) {
      recommendation = 'reject';
    } else if (quality === 'excellent' || (quality === 'good' && warnings.length <= 1)) {
      recommendation = 'accept';
    } else {
      recommendation = 'review';
    }

    return {
      overall: {
        quality,
        score: Math.min(100, Math.max(0, qualityScore)),
        isQualified,
      },
      semanticValidation: params.semantic,
      classification: params.classification,
      locationValidation: params.location,
      confidence: params.confidence,
      rejection: params.rejection,
      recommendation,
      warnings: [...new Set(warnings)],
    };
  }
}

export const leadQualityEngine = new LeadQualityEngine();
