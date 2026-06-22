export interface SemanticQueryProgress {
  queryId: string;
  keyword: string;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  leadsFound: number;
  leadsStored: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  retriesUsed: number;
}

export interface ScrapingProgressData {
  sessionId: string;
  keyword: string;
  location: string;
  area: string;
  city: string;
  state: string;
  businessType: string;
  status: 'running' | 'completed' | 'failed';
  totalFound: number;
  totalScraped: number;
  totalSaved: number;
  totalDuplicates: number;
  totalRejected: number;
  errors: string[];
  startedAt: string;
  updatedAt: string;
  semanticQueries?: SemanticQueryProgress[];
  totalSemanticQueries?: number;
  completedSemanticQueries?: number;
  failedSemanticQueries?: number;
  isPartialSuccess?: boolean;
}

class ScrapingProgressTracker {
  private sessions: Map<string, ScrapingProgressData> = new Map();

  createSession(sessionId: string, data: Partial<ScrapingProgressData>): ScrapingProgressData {
    const session: ScrapingProgressData = {
      sessionId,
      keyword: data.keyword || '',
      location: data.location || '',
      area: data.area || '',
      city: data.city || '',
      state: data.state || '',
      businessType: data.businessType || '',
      status: 'running',
      totalFound: 0,
      totalScraped: 0,
      totalSaved: 0,
      totalDuplicates: 0,
      totalRejected: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  createSemanticSession(
    sessionId: string,
    data: Partial<ScrapingProgressData>,
    totalQueries: number
  ): ScrapingProgressData {
    const session = this.createSession(sessionId, data);
    const queries: SemanticQueryProgress[] = [];
    for (let i = 0; i < totalQueries; i++) {
      queries.push({
        queryId: `q_${sessionId}_${i}`,
        keyword: '',
        source: '',
        status: 'pending',
        leadsFound: 0,
        leadsStored: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        retriesUsed: 0,
      });
    }
    session.semanticQueries = queries;
    session.totalSemanticQueries = totalQueries;
    session.completedSemanticQueries = 0;
    session.failedSemanticQueries = 0;
    session.isPartialSuccess = false;
    return session;
  }

  updateSemanticQueryProgress(
    sessionId: string,
    queryIndex: number,
    updates: Partial<SemanticQueryProgress>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session && session.semanticQueries && session.semanticQueries[queryIndex]) {
      Object.assign(session.semanticQueries[queryIndex], updates);
      session.updatedAt = new Date().toISOString();
    }
  }

  setSemanticQueryCompleted(sessionId: string, queryIndex: number): void {
    this.updateSemanticQueryProgress(sessionId, queryIndex, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      durationMs: 0,
    });
    const session = this.sessions.get(sessionId);
    if (session) {
      session.completedSemanticQueries = (session.completedSemanticQueries || 0) + 1;
    }
  }

  setSemanticQueryFailed(sessionId: string, queryIndex: number, error: string): void {
    this.updateSemanticQueryProgress(sessionId, queryIndex, {
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    });
    const session = this.sessions.get(sessionId);
    if (session) {
      session.failedSemanticQueries = (session.failedSemanticQueries || 0) + 1;
    }
  }

  setSemanticQuerySkipped(sessionId: string, queryIndex: number, reason: string): void {
    this.updateSemanticQueryProgress(sessionId, queryIndex, {
      status: 'skipped',
      error: reason,
      completedAt: new Date().toISOString(),
    });
    const session = this.sessions.get(sessionId);
    if (session) {
      session.completedSemanticQueries = (session.completedSemanticQueries || 0) + 1;
    }
  }

  markPartialSuccess(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isPartialSuccess = true;
    }
  }

  updateProgress(sessionId: string, updates: Partial<ScrapingProgressData>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.updatedAt = new Date().toISOString();
    }
  }

  incrementFound(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalFound += count;
      session.updatedAt = new Date().toISOString();
    }
  }

  incrementScraped(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalScraped += count;
      session.updatedAt = new Date().toISOString();
    }
  }

  incrementSaved(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalSaved += count;
      session.updatedAt = new Date().toISOString();
    }
  }

  incrementDuplicates(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalDuplicates += count;
      session.updatedAt = new Date().toISOString();
    }
  }

  incrementRejected(sessionId: string, count = 1): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalRejected += count;
      session.updatedAt = new Date().toISOString();
    }
  }

  getProgress(sessionId: string): ScrapingProgressData | null {
    return this.sessions.get(sessionId) || null;
  }

  completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.updatedAt = new Date().toISOString();
    }
  }

  failSession(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.errors.push(error);
      session.updatedAt = new Date().toISOString();
    }
  }

  generateSessionId(): string {
    return `scrape_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  cleanupOldSessions(maxAgeMs = 3600000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - new Date(session.startedAt).getTime() > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }
}

export const scrapingProgress = new ScrapingProgressTracker();
