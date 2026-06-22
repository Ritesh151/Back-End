import { businessCategoryEngine } from '../modules/search/businessCategoryEngine';
import type { ExpandedKeyword } from '../modules/search/businessCategoryEngine';
import { logger } from '../utils/logger';

export interface SemanticSearchQuery {
  keyword: string;
  originalKeyword: string;
  categoryGroupId: string;
  categoryGroupName: string;
  priority: number;
  isPrimary: boolean;
  localizedQuery: string;
  sourceQueries: SemanticSourceQuery[];
}

export interface SemanticSourceQuery {
  source: string;
  query: string;
  url: string;
}

export interface SemanticExpansionResult {
  originalKeyword: string;
  matchedCategory: {
    id: string;
    name: string;
  } | null;
  expandedKeywords: ExpandedKeyword[];
  queries: SemanticSearchQuery[];
  coverage: {
    totalQueries: number;
    primaryQueries: number;
    expandedQueries: number;
    groupsCovered: string[];
  };
  validationError?: string;
}

const MAX_EXPANDED_QUERIES = 12;
const MAX_AI_KEYWORDS = 8;
const MIN_KEYWORD_LENGTH = 2;

export class SemanticSearchService {
  validateInput(input: string): string | null {
    if (!input || typeof input !== 'string') {
      return 'Keyword is required and must be a string';
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return 'Keyword cannot be empty';
    }
    if (trimmed.length < MIN_KEYWORD_LENGTH) {
      return `Keyword must be at least ${MIN_KEYWORD_LENGTH} characters`;
    }
    if (trimmed.length > 200) {
      return 'Keyword is too long (max 200 characters)';
    }
    return null;
  }

  validateSources(sources: string[]): string | null {
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return 'At least one source is required';
    }
    const validSources = ['google-maps', 'justdial', 'indiamart', 'clutch'];
    const invalid = sources.filter(s => !validSources.includes(s));
    if (invalid.length > 0) {
      return `Invalid sources: ${invalid.join(', ')}. Valid: ${validSources.join(', ')}`;
    }
    return null;
  }

  deduplicateQueries(queries: SemanticSearchQuery[]): SemanticSearchQuery[] {
    const seen = new Set<string>();
    return queries.filter(q => {
      const key = q.keyword.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  expand(input: string, sources: string[], state?: string, city?: string, area?: string): SemanticExpansionResult {
    const validationError = this.validateInput(input);
    if (validationError) {
      return {
        originalKeyword: input,
        matchedCategory: null,
        expandedKeywords: [],
        queries: [],
        coverage: {
          totalQueries: 0,
          primaryQueries: 0,
          expandedQueries: 0,
          groupsCovered: [],
        },
        validationError,
      };
    }

    const sanitizedInput = input.trim();
    const expandedKeywords = businessCategoryEngine.expandKeyword(sanitizedInput);
    const categoryGroup = businessCategoryEngine.getCategoryGroup(sanitizedInput);

    const queries: SemanticSearchQuery[] = [];

    for (const ek of expandedKeywords) {
      const localizedQuery = this.buildLocalizedQuery(ek.keyword, state, city, area);
      const sourceQueries = this.buildSourceQueries(ek.keyword, sources, state, city, area);

      queries.push({
        keyword: ek.keyword,
        originalKeyword: sanitizedInput,
        categoryGroupId: ek.categoryGroupId,
        categoryGroupName: ek.categoryGroupName,
        priority: ek.priority,
        isPrimary: ek.isPrimary,
        localizedQuery,
        sourceQueries,
      });
    }

    const deduped = this.deduplicateQueries(queries);
    const primaryQueries = deduped.filter(q => q.isPrimary);
    const expandedQueries = deduped.filter(q => !q.isPrimary);

    return {
      originalKeyword: sanitizedInput,
      matchedCategory: categoryGroup ? { id: categoryGroup.id, name: categoryGroup.name } : null,
      expandedKeywords,
      queries: deduped,
      coverage: {
        totalQueries: deduped.length,
        primaryQueries: primaryQueries.length,
        expandedQueries: expandedQueries.length,
        groupsCovered: [...new Set(deduped.map(q => q.categoryGroupName))],
      },
    };
  }

  expandWithAIFallback(input: string, sources: string[], state?: string, city?: string, area?: string): SemanticExpansionResult {
    const validationError = this.validateInput(input);
    if (validationError) {
      return {
        originalKeyword: input,
        matchedCategory: null,
        expandedKeywords: [],
        queries: [],
        coverage: {
          totalQueries: 0,
          primaryQueries: 0,
          expandedQueries: 0,
          groupsCovered: [],
        },
        validationError,
      };
    }

    const sanitizedInput = input.trim();
    const result = this.expand(sanitizedInput, sources, state, city, area);

    if ((result.matchedCategory === null || result.expandedKeywords.length <= 1)) {
      try {
        const aiKeywords = businessCategoryEngine.findAISemanticMatch(sanitizedInput);

        if (aiKeywords && aiKeywords.length > 1) {
          const limitedAI = aiKeywords.slice(0, MAX_AI_KEYWORDS);

          logger.info({
            action: 'ai_semantic_fallback',
            originalKeyword: sanitizedInput,
            aiKeywords: limitedAI,
            totalAIKeywords: aiKeywords.length,
          }, 'SemanticSearch: Using AI fallback expansion');

          const aiExpanded: ExpandedKeyword[] = limitedAI.map((keyword, idx) => ({
            keyword,
            originalQuery: sanitizedInput,
            categoryGroupId: 'ai-matched',
            categoryGroupName: 'AI Matched',
            priority: idx === 0 ? 1 : 3,
            isPrimary: idx === 0,
          }));

          const aiQueries: SemanticSearchQuery[] = aiExpanded.map(ek => {
            const localizedQuery = this.buildLocalizedQuery(ek.keyword, state, city, area);
            return {
              keyword: ek.keyword,
              originalKeyword: sanitizedInput,
              categoryGroupId: ek.categoryGroupId,
              categoryGroupName: ek.categoryGroupName,
              priority: ek.priority,
              isPrimary: ek.isPrimary,
              localizedQuery,
              sourceQueries: this.buildSourceQueries(ek.keyword, sources, state, city, area),
            };
          });

          const dedupedAI = this.deduplicateQueries(aiQueries);

          return {
            originalKeyword: sanitizedInput,
            matchedCategory: null,
            expandedKeywords: aiExpanded,
            queries: dedupedAI,
            coverage: {
              totalQueries: dedupedAI.length,
              primaryQueries: 1,
              expandedQueries: dedupedAI.length - 1,
              groupsCovered: ['AI Matched'],
            },
          };
        }
      } catch (error: unknown) {
        logger.error({
          err: error instanceof Error ? error.message : String(error),
          originalKeyword: sanitizedInput,
        }, 'SemanticSearch: AI fallback failed, using base expansion');
      }
    }

    const dedupedResult = {
      ...result,
      queries: this.deduplicateQueries(result.queries),
    };

    return dedupedResult;
  }

  getLimitedExpandedQueries(
    input: string, sources: string[], state?: string, city?: string, area?: string, maxQueries = 10
  ): SemanticSearchQuery[] {
    const validatedMax = Math.min(Math.max(1, maxQueries), MAX_EXPANDED_QUERIES);
    const result = this.expandWithAIFallback(input, sources, state, city, area);

    if (result.validationError || result.queries.length === 0) {
      return [];
    }

    const sortedQueries = [...result.queries].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.priority - b.priority;
    });

    return sortedQueries.slice(0, validatedMax);
  }

  private buildLocalizedQuery(keyword: string, state?: string, city?: string, area?: string): string {
    const parts: string[] = [keyword];
    const locationParts: string[] = [];

    if (area) locationParts.push(`in ${area}`);
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);

    if (locationParts.length > 0) {
      parts.push(locationParts.join(' '));
    }

    return parts.join(' ').trim();
  }

  private buildSourceQueries(keyword: string, sources: string[], state?: string, city?: string, area?: string): SemanticSourceQuery[] {
    const queries: SemanticSourceQuery[] = [];

    const businessSlug = keyword.toLowerCase().replace(/\s+/g, ' ');
    const citySlug = city ? city.toLowerCase().replace(/\s+/g, '-') : '';
    const areaSlug = area ? area.toLowerCase().replace(/\s+/g, '-') : '';

    const locationParts: string[] = [];
    if (area) locationParts.push(area);
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);
    const locationStr = locationParts.join(' ');

    for (const source of sources) {
      switch (source) {
        case 'google-maps': {
          const query = locationStr
            ? `${keyword} in ${locationStr}`
            : keyword;
          queries.push({
            source: 'google-maps',
            query,
            url: `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
          });
          break;
        }
        case 'justdial': {
          const query = city
            ? `${keyword} in ${city}`
            : keyword;
          const url = area
            ? `https://www.justdial.com/${citySlug}/${businessSlug.replace(/\s+/g, '-')}-in-${areaSlug}`
            : `https://www.justdial.com/${citySlug}/${businessSlug.replace(/\s+/g, '-')}`;
          queries.push({
            source: 'justdial',
            query,
            url,
          });
          break;
        }
        case 'indiamart': {
          const query = city
            ? `${keyword} ${city}`
            : keyword;
          queries.push({
            source: 'indiamart',
            query,
            url: `https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(query)}`,
          });
          break;
        }
        case 'clutch': {
          const query = `${keyword} ${city || ''} ${state || ''}`.trim();
          queries.push({
            source: 'clutch',
            query,
            url: `https://clutch.co/search?q=${encodeURIComponent(query)}`,
          });
          break;
        }
      }
    }

    return queries;
  }

  getSearchCoverageReport(input: string, sources: string[], state?: string, city?: string, area?: string) {
    const result = this.expandWithAIFallback(input, sources, state, city, area);

    return {
      originalKeyword: result.originalKeyword,
      matchedCategory: result.matchedCategory,
      coverage: result.coverage,
      expandedKeywordsPreview: result.expandedKeywords.slice(0, 5).map(ek => ek.keyword),
      totalExpandedKeywords: result.expandedKeywords.length,
      totalQueries: result.queries.length,
      totalGoogleMapsQueries: result.queries.filter(q => q.sourceQueries.some(sq => sq.source === 'google-maps')).length,
      totalJustdialQueries: result.queries.filter(q => q.sourceQueries.some(sq => sq.source === 'justdial')).length,
      totalIndiaMartQueries: result.queries.filter(q => q.sourceQueries.some(sq => sq.source === 'indiamart')).length,
      totalClutchQueries: result.queries.filter(q => q.sourceQueries.some(sq => sq.source === 'clutch')).length,
    };
  }
}

export const semanticSearchService = new SemanticSearchService();
