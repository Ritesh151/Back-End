import {
  emitSearchStart, emitSearchProgress, emitLeadFound, emitSourceUpdate,
  emitSearchCompleted, emitSearchError, emitSearchRecovered,
  emitLeadSaved, emitDuplicateRemoved, emitSearchHistoryUpdate,
} from '../modules/automation-monitor/socket-manager';
import { SearchHistory } from '../models/SearchHistory';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';

export interface SearchStatusData {
  sessionId: string;
  keyword: string;
  location: string;
  state?: string;
  city?: string;
  area?: string;
  sources: string[];
  status: 'running' | 'completed' | 'failed';
  leadsFound: number;
  uniqueLeads: number;
  duplicatesRemoved: number;
  sourceBreakdown: Record<string, number>;
  keywordBreakdown: Record<string, number>;
  liveLeads: string[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  failedCount: number;
  progressPercentage: number;
  estimatedRemaining: number;
  currentSource: string;
  estimatedTotal: number;
  createdBy?: string;
}

class SearchStatusTracker {
  private sessions: Map<string, SearchStatusData> = new Map();

  createSession(sessionId: string, data: Partial<SearchStatusData>): SearchStatusData {
    const session: SearchStatusData = {
      sessionId,
      keyword: data.keyword || '',
      location: data.location || '',
      state: data.state,
      city: data.city,
      area: data.area,
      sources: data.sources || ['google-maps'],
      status: 'running',
      leadsFound: 0,
      uniqueLeads: 0,
      duplicatesRemoved: 0,
      sourceBreakdown: {},
      keywordBreakdown: {},
      liveLeads: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failedCount: 0,
      progressPercentage: 0,
      estimatedRemaining: 0,
      currentSource: data.sources && data.sources.length > 0 ? data.sources[0] : '',
      estimatedTotal: 0,
      createdBy: data.createdBy,
    };
    this.sessions.set(sessionId, session);
    emitSearchStart(sessionId, {
      keyword: session.keyword,
      location: session.location,
      state: session.state,
      city: session.city,
      area: session.area,
      sources: session.sources,
    });

    // Route handler already creates the SearchHistory doc with status='running' before calling this.
    // Only upsert with $setOnInsert so we never overwrite status (which races with markCompleted).
    SearchHistory.findOneAndUpdate(
      { searchSessionId: sessionId },
      {
        $setOnInsert: {
          searchSessionId: sessionId,
          keyword: session.keyword,
          state: session.state,
          city: session.city,
          area: session.area,
          sources: session.sources,
          startedAt: new Date(session.startedAt),
          status: 'running',
          isRunning: true,
          progress: 0,
          currentFound: 0,
          currentSaved: 0,
          currentDuplicates: 0,
          failedCount: 0,
          estimatedTotal: 0,
          currentSource: '',
          createdBy: session.createdBy || undefined,
        },
      },
      { upsert: true }
    ).catch(err => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'SearchStatusTracker: Failed to upsert search history');
    });

    return session;
  }

  incrementFound(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.leadsFound += count;
      session.updatedAt = new Date().toISOString();
      this.recalculatePercentage(session);
      this.emitProgress(sessionId);
      this.updateDBSearchHistory(session).catch(() => {});
    }
  }

  incrementSaved(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.uniqueLeads += count;
      session.updatedAt = new Date().toISOString();
      this.recalculatePercentage(session);
      emitLeadSaved(sessionId, { totalSaved: session.uniqueLeads });
      this.emitProgress(sessionId);
      this.updateDBSearchHistory(session).catch(() => {});
    }
  }

  incrementDuplicates(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.duplicatesRemoved += count;
      session.updatedAt = new Date().toISOString();
      this.recalculatePercentage(session);
      emitDuplicateRemoved(sessionId, { totalDuplicates: session.duplicatesRemoved });
      this.emitProgress(sessionId);
      this.updateDBSearchHistory(session).catch(() => {});
    }
  }

  incrementFailed(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.failedCount += count;
      session.updatedAt = new Date().toISOString();
      this.recalculatePercentage(session);
      this.emitProgress(sessionId);
      this.updateDBSearchHistory(session).catch(() => {});
    }
  }

  updateLeadsFound(sessionId: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.leadsFound = count;
      session.updatedAt = new Date().toISOString();
      this.recalculatePercentage(session);
      this.emitProgress(sessionId);
      this.updateDBSearchHistory(session).catch(() => {});
    }
  }

  updateEstimatedTotal(sessionId: string, total: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.estimatedTotal = total;
      this.recalculatePercentage(session);
      this.updateDBSearchHistory(session).catch(() => {});
    }
  }

  updateCurrentSource(sessionId: string, source: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentSource = source;
      session.updatedAt = new Date().toISOString();
      this.emitProgress(sessionId);
      this.updateDBSearchHistory(session).catch(() => {});
    }
  }

  private recalculatePercentage(session: SearchStatusData): void {
    if (session.leadsFound === 0) {
      session.progressPercentage = 0;
      session.estimatedRemaining = 0;
    } else {
      const processed = session.uniqueLeads + session.duplicatesRemoved + session.failedCount;
      session.progressPercentage = Math.min(99, Math.round((processed / session.leadsFound) * 100));
      session.estimatedRemaining = Math.max(0, session.leadsFound - processed);
    }
  }

  private emitProgress(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    emitSearchProgress(sessionId, {
      foundCount: session.leadsFound,
      savedCount: session.uniqueLeads,
      duplicateCount: session.duplicatesRemoved,
      failedCount: session.failedCount,
      progress: session.progressPercentage,
      currentSource: session.currentSource,
      currentLead: session.liveLeads[session.liveLeads.length - 1] || '',
      updatedAt: new Date().toISOString(),
    });
  }

  updateUniqueLeads(sessionId: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.uniqueLeads = count;
      session.updatedAt = new Date().toISOString();
      this.recalculatePercentage(session);
      this.updateDBSearchHistory(session);
    }
  }

  updateDuplicatesRemoved(sessionId: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.duplicatesRemoved = count;
      session.updatedAt = new Date().toISOString();
      this.recalculatePercentage(session);
      this.updateDBSearchHistory(session);
    }
  }

  updateSourceBreakdown(sessionId: string, source: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.sourceBreakdown[source] = count;
      session.updatedAt = new Date().toISOString();
      emitSourceUpdate(sessionId, { source, count, status: 'completed' });
      this.emitProgress(sessionId);
      this.updateDBSearchHistory(session);
    }
  }

  updateKeywordBreakdown(sessionId: string, keyword: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.keywordBreakdown[keyword] = count;
      session.updatedAt = new Date().toISOString();
    }
  }

  addLiveLead(sessionId: string, businessName: string, source = ''): void {
    const session = this.sessions.get(sessionId);
    if (session && !session.liveLeads.includes(businessName)) {
      session.liveLeads.push(businessName);
      if (session.liveLeads.length > 50) {
        session.liveLeads = session.liveLeads.slice(-50);
      }
      session.updatedAt = new Date().toISOString();
      emitLeadFound(sessionId, {
        businessName,
        source,
        totalLeads: session.leadsFound,
      });
    }
  }

  async markCompleted(
    sessionId: string,
    partialSuccess = false,
    completedSources: string[] = [],
    failedSources: string[] = []
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.progressPercentage = 100;
      session.estimatedRemaining = 0;
      session.completedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      this.emitProgress(sessionId);
      emitSearchCompleted(sessionId, {
        keyword: session.keyword,
        location: session.location,
        totalLeads: session.leadsFound,
        uniqueLeads: session.uniqueLeads,
        duplicatesRemoved: session.duplicatesRemoved,
        sourceBreakdown: { ...session.sourceBreakdown },
        durationMs: Date.now() - new Date(session.startedAt).getTime(),
        state: session.state,
        city: session.city,
        area: session.area,
        sources: session.sources,
      });

      const totalLeads = await Lead.countDocuments({ searchSessionId: sessionId });

      await this.updateDBSearchHistory(session, {
        completedAt: new Date(session.completedAt),
        duration: Date.now() - new Date(session.startedAt).getTime(),
        partialSuccess,
        completedSources,
        failedSources,
        totalLeads,
      });

      await this.emitHistoryUpdate(session);
    }
  }

  async markFailed(sessionId: string, error: string, failedSources: string[] = []): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.error = error;
      session.completedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      emitSearchError(sessionId, { error });

      await this.updateDBSearchHistory(session, {
        completedAt: new Date(session.completedAt),
        duration: Date.now() - new Date(session.startedAt).getTime(),
        failedSources,
        failureReason: error,
      });

      await this.emitHistoryUpdate(session);
    }
  }

  private async updateDBSearchHistory(session: SearchStatusData, extra: Record<string, any> = {}): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        totalFound: session.leadsFound,
        uniqueSaved: session.uniqueLeads,
        duplicates: session.duplicatesRemoved,
        duplicatesRemoved: session.duplicatesRemoved,
        status: session.status,
        isRunning: session.status === 'running',
        progress: session.progressPercentage,
        currentFound: session.leadsFound,
        currentSaved: session.uniqueLeads,
        currentDuplicates: session.duplicatesRemoved,
        estimatedTotal: session.estimatedTotal,
        currentSource: session.currentSource,
        failedCount: session.failedCount,
        error: session.error,
        ...extra,
      };

      if (extra.totalLeads !== undefined) {
        updateData.totalLeads = extra.totalLeads;
      }

      await SearchHistory.updateOne(
        { searchSessionId: session.sessionId },
        { $set: updateData }
      );
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'SearchStatusTracker: Failed to update SearchHistory in DB');
    }
  }

  private async emitHistoryUpdate(session: SearchStatusData): Promise<void> {
    try {
      const totalLeads = await Lead.countDocuments({ searchSessionId: session.sessionId });
      emitSearchHistoryUpdate(session.sessionId, {
        keyword: session.keyword,
        state: session.state,
        city: session.city,
        area: session.area,
        sources: session.sources,
        totalLeads,
        startedAt: session.startedAt,
        completedAt: session.completedAt || new Date().toISOString(),
        duration: session.completedAt
          ? Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
          : 0,
        status: session.status,
      });
    } catch {
    }
  }

  getProgress(sessionId: string): SearchStatusData | null {
    return this.sessions.get(sessionId) || null;
  }

  async getActiveSession(): Promise<SearchStatusData | null> {
    const active = await SearchHistory.findOne(
      { status: 'running', isRunning: true },
      {},
      { sort: { startedAt: -1 } }
    ).lean();

    if (!active) return null;

    const session = this.sessions.get(active.searchSessionId);
    if (session) return session;

    const restored: SearchStatusData = {
      sessionId: active.searchSessionId,
      keyword: active.keyword,
      location: [active.area, active.city, active.state].filter(Boolean).join(', '),
      state: active.state,
      city: active.city,
      area: active.area,
      sources: active.sources || [],
      status: 'running',
      leadsFound: active.currentFound || 0,
      uniqueLeads: active.currentSaved || 0,
      duplicatesRemoved: active.currentDuplicates || 0,
      sourceBreakdown: {},
      keywordBreakdown: {},
      liveLeads: [],
      startedAt: active.startedAt?.toISOString() || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failedCount: 0,
      progressPercentage: active.progress || 0,
      estimatedRemaining: 0,
      currentSource: active.currentSource || '',
      estimatedTotal: active.estimatedTotal || 0,
    };

    this.sessions.set(restored.sessionId, restored);

    emitSearchRecovered(restored.sessionId, {
      keyword: restored.keyword,
      location: restored.location,
      state: restored.state,
      city: restored.city,
      area: restored.area,
      sources: restored.sources,
      leadsFound: restored.leadsFound,
      uniqueLeads: restored.uniqueLeads,
      duplicatesRemoved: restored.duplicatesRemoved,
      failedCount: 0,
      progressPercentage: restored.progressPercentage,
      elapsedMs: Date.now() - new Date(restored.startedAt).getTime(),
    });

    return restored;
  }

  cleanupOldSessions(maxAgeMs = 3600000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - new Date(session.startedAt).getTime() > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }

  cleanupAll(): void {
    this.sessions.clear();
  }

  generateSessionId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

export const searchStatus = new SearchStatusTracker();
