import { logger } from '../utils/logger';
import type { ExpandedKeyword } from '../modules/search/businessCategoryEngine';

export interface QueryCoverage {
  keyword: string;
  originalKeyword: string;
  categoryGroup: string;
  priority: number;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  leadsDiscovered: number;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  error?: string;
}

export interface SearchSessionCoverage {
  sessionId: string;
  originalKeyword: string;
  matchedCategory: string | null;
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  totalLeadsDiscovered: number;
  totalLeadsStored: number;
  totalDuplicatesRemoved: number;
  queries: QueryCoverage[];
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

type SearchMetricsCallback = (metrics: SearchSessionCoverage) => void;

export class SearchCoverageService {
  private sessions: Map<string, SearchSessionCoverage> = new Map();
  private listeners: Map<string, SearchMetricsCallback> = new Map();

  createSession(sessionId: string, originalKeyword: string, expandedKeywords: ExpandedKeyword[], sources: string[]): SearchSessionCoverage {
    const queries: QueryCoverage[] = [];

    for (const ek of expandedKeywords) {
      for (const source of sources) {
        queries.push({
          keyword: ek.keyword,
          originalKeyword,
          categoryGroup: ek.categoryGroupName,
          priority: ek.priority,
          source,
          status: 'pending',
          leadsDiscovered: 0,
        });
      }
    }

    const session: SearchSessionCoverage = {
      sessionId,
      originalKeyword,
      matchedCategory: expandedKeywords.length > 0 ? expandedKeywords[0].categoryGroupName : null,
      totalQueries: queries.length,
      completedQueries: 0,
      failedQueries: 0,
      totalLeadsDiscovered: 0,
      totalLeadsStored: 0,
      totalDuplicatesRemoved: 0,
      queries,
      startTime: Date.now(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  markQueryRunning(sessionId: string, keyword: string, source: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const query = session.queries.find(q => q.keyword === keyword && q.source === source);
    if (query) {
      query.status = 'running';
      query.startTime = Date.now();
    }
  }

  markQueryCompleted(sessionId: string, keyword: string, source: string, leadsFound: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const query = session.queries.find(q => q.keyword === keyword && q.source === source);
    if (query) {
      query.status = 'completed';
      query.endTime = Date.now();
      query.durationMs = query.endTime - (query.startTime || query.endTime);
      query.leadsDiscovered = leadsFound;
      session.completedQueries++;
      session.totalLeadsDiscovered += leadsFound;
    }

    this.notifyListeners(sessionId);
  }

  markQueryFailed(sessionId: string, keyword: string, source: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const query = session.queries.find(q => q.keyword === keyword && q.source === source);
    if (query) {
      query.status = 'failed';
      query.endTime = Date.now();
      query.durationMs = query.endTime - (query.startTime || query.endTime);
      query.error = error;
      session.failedQueries++;
    }

    this.notifyListeners(sessionId);
  }

  addDuplicates(sessionId: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalDuplicatesRemoved += count;
    }
  }

  addStored(sessionId: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalLeadsStored += count;
    }
  }

  completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = Date.now();
      session.durationMs = session.endTime - session.startTime;

      logger.info({
        action: 'search_session_completed',
        sessionId,
        originalKeyword: session.originalKeyword,
        totalQueries: session.totalQueries,
        completedQueries: session.completedQueries,
        failedQueries: session.failedQueries,
        totalLeadsDiscovered: session.totalLeadsDiscovered,
        totalLeadsStored: session.totalLeadsStored,
        totalDuplicatesRemoved: session.totalDuplicatesRemoved,
        durationMs: session.durationMs,
      }, 'SearchCoverage: Search session completed');

      this.notifyListeners(sessionId);
    }
  }

  getSession(sessionId: string): SearchSessionCoverage | undefined {
    return this.sessions.get(sessionId);
  }

  getQueryCoverage(sessionId: string, keyword: string, source: string): QueryCoverage | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    return session.queries.find(q => q.keyword === keyword && q.source === source);
  }

  subscribe(sessionId: string, callback: SearchMetricsCallback): void {
    this.listeners.set(sessionId, callback);
  }

  unsubscribe(sessionId: string): void {
    this.listeners.delete(sessionId);
  }

  private notifyListeners(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    const callback = this.listeners.get(sessionId);
    if (session && callback) {
      callback(session);
    }
  }

  getAggregateStats(): {
    totalSessions: number;
    totalQueries: number;
    totalCompletedQueries: number;
    totalFailedQueries: number;
    totalLeadsDiscovered: number;
    totalLeadsStored: number;
    totalDuplicatesRemoved: number;
    topCategories: Array<{ category: string; leads: number; queries: number }>;
  } {
    let totalQueries = 0;
    let totalCompletedQueries = 0;
    let totalFailedQueries = 0;
    let totalLeadsDiscovered = 0;
    let totalLeadsStored = 0;
    let totalDuplicatesRemoved = 0;

    const categoryStats = new Map<string, { leads: number; queries: number }>();

    for (const session of this.sessions.values()) {
      totalQueries += session.totalQueries;
      totalCompletedQueries += session.completedQueries;
      totalFailedQueries += session.failedQueries;
      totalLeadsDiscovered += session.totalLeadsDiscovered;
      totalLeadsStored += session.totalLeadsStored;
      totalDuplicatesRemoved += session.totalDuplicatesRemoved;

      for (const query of session.queries) {
        if (query.status === 'completed' && query.leadsDiscovered > 0) {
          const existing = categoryStats.get(query.categoryGroup) || { leads: 0, queries: 0 };
          existing.leads += query.leadsDiscovered;
          existing.queries++;
          categoryStats.set(query.categoryGroup, existing);
        }
      }
    }

    return {
      totalSessions: this.sessions.size,
      totalQueries,
      totalCompletedQueries,
      totalFailedQueries,
      totalLeadsDiscovered,
      totalLeadsStored,
      totalDuplicatesRemoved,
      topCategories: Array.from(categoryStats.entries())
        .map(([category, stats]) => ({ category, ...stats }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10),
    };
  }
}

export const searchCoverageService = new SearchCoverageService();
