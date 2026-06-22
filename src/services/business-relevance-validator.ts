import { aiRelevanceService } from '../ai-validation/ai-relevance.service';

export interface RelevanceResult {
  relevant: boolean;
  score: number;
  matchedKeywords: string[];
  validatedCategory: string;
}

export interface AIValidationResult {
  relevant: boolean;
  relevanceScore: number;
  categoryConfidence: number;
  locationConfidence: number;
  finalConfidence: number;
  validationStatus: 'validated' | 'rejected' | 'needs-review';
  rejectionReason: string | undefined;
  quality: 'excellent' | 'good' | 'average' | 'poor';
  matchedKeywords: string[];
  validatedCategory: string;
  matchType: string;
  warnings: string[];
}

export class BusinessRelevanceValidator {
  validate(
    companyName: string,
    category: string | undefined,
    businessType: string
  ): RelevanceResult {
    return aiRelevanceService.getSemanticValidator().validate(companyName, category, businessType);
  }

  validateLocation(
    address: string | undefined,
    targetArea?: string,
    targetCity?: string,
    targetState?: string
  ): { relevant: boolean; score: number } {
    const result = aiRelevanceService.validate({
      companyName: '',
      businessType: '',
      address,
      targetArea,
      targetCity,
      targetState,
      source: '',
    }).locationValidation;
    return { relevant: result.relevant, score: result.locationConfidence };
  }

  validateWithAI(
    companyName: string,
    category: string | undefined,
    businessType: string,
    address?: string,
    website?: string,
    phone?: string,
    email?: string,
    rating?: number,
    source?: string,
    targetArea?: string,
    targetCity?: string,
    targetState?: string
  ): AIValidationResult {
    const output = aiRelevanceService.validate({
      companyName,
      category,
      businessType,
      address,
      website,
      phone,
      email,
      rating,
      source: source || '',
      targetArea,
      targetCity,
      targetState,
    });

    let validationStatus: AIValidationResult['validationStatus'];
    if (output.rejection.rejected) {
      validationStatus = 'rejected';
    } else if (output.quality.recommendation === 'review') {
      validationStatus = 'needs-review';
    } else {
      validationStatus = 'validated';
    }

    return {
      relevant: !output.rejection.rejected,
      relevanceScore: output.semanticValidation.score,
      categoryConfidence: output.semanticValidation.categoryConfidence,
      locationConfidence: output.locationValidation.locationConfidence,
      finalConfidence: output.confidence.finalConfidence,
      validationStatus,
      rejectionReason: output.rejection.reason,
      quality: output.quality.overall.quality,
      matchedKeywords: output.semanticValidation.matchedKeywords,
      validatedCategory: output.semanticValidation.validatedCategory,
      matchType: output.semanticValidation.matchType,
      warnings: output.quality.warnings,
    };
  }
}

export const businessRelevanceValidator = new BusinessRelevanceValidator();
