export interface SearchInput {
  businessType: string;
  state?: string;
  city?: string;
  area?: string;
  sources: string[];
}

export interface SourceQuery {
  source: string;
  query: string;
  url: string;
  fullSearchQuery: string;
  semanticKeyword?: string;
  categoryGroup?: string;
  priority?: number;
  isSemanticExpansion?: boolean;
}

export interface MultiQueryInput {
  keywords: string[];
  state?: string;
  city?: string;
  area?: string;
  sources: string[];
}

export class SearchQueryBuilder {
  build(input: SearchInput): SourceQuery[] {
    const { businessType, state, city, area, sources } = input;
    const queries: SourceQuery[] = [];

    for (const source of sources) {
      switch (source) {
        case 'google-maps': {
          const query = area
            ? `${businessType} in ${area} ${city} ${state || ''}`
            : city
              ? `${businessType} in ${city} ${state || ''}`
              : businessType;

          const locationParts: string[] = [];
          if (area) locationParts.push(area);
          if (city) locationParts.push(city);
          if (state) locationParts.push(state);
          const locationStr = locationParts.length > 0 ? locationParts.join(', ') : '';

          const fullSearchQuery = area
            ? `${businessType} in ${locationStr}`
            : city
              ? `${businessType} in ${locationStr}`
              : businessType;

          queries.push({
            source: 'google-maps',
            query,
            url: `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
            fullSearchQuery,
          });
          break;
        }
        case 'justdial': {
          const citySlug = city ? city.toLowerCase().replace(/\s+/g, '-') : 'india';
          const areaSlug = area ? area.toLowerCase().replace(/\s+/g, '-') : '';
          const businessSlug = businessType.toLowerCase().replace(/\s+/g, '-');

          const query = area
            ? `${businessType} in ${area} ${city}`
            : city
              ? `${businessType} in ${city}`
              : businessType;

          const url = area
            ? `https://www.justdial.com/${citySlug}/${businessSlug}-in-${areaSlug}`
            : `https://www.justdial.com/${citySlug}/${businessSlug}`;

          queries.push({
            source: 'justdial',
            query,
            url,
            fullSearchQuery: query,
          });
          break;
        }
        case 'indiamart': {
          const query = area
            ? `${businessType} ${area} ${city}`
            : city
              ? `${businessType} ${city}`
              : businessType;

          queries.push({
            source: 'indiamart',
            query,
            url: `https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(query)}`,
            fullSearchQuery: query,
          });
          break;
        }
        case 'clutch': {
          const query = `${businessType} ${city || ''} ${state || ''}`.trim();
          queries.push({
            source: 'clutch',
            query,
            url: `https://clutch.co/search?q=${encodeURIComponent(query)}`,
            fullSearchQuery: query,
          });
          break;
        }
      }
    }

    return queries;
  }

  buildMultiQuery(input: MultiQueryInput): SourceQuery[] {
    const { keywords, state, city, area, sources } = input;
    const allQueries: SourceQuery[] = [];

    for (const keyword of keywords) {
      const keywordQueries = this.build({
        businessType: keyword,
        state,
        city,
        area,
        sources,
      });

      for (const q of keywordQueries) {
        allQueries.push({
          ...q,
          semanticKeyword: keyword,
          isSemanticExpansion: true,
        });
      }
    }

    return allQueries;
  }
}

export const searchQueryBuilder = new SearchQueryBuilder();
