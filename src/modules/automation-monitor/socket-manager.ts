import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../../utils/logger';

let io: Server | null = null;

const SESSION_NS = '/automation-monitor';

export function initSocketManager(httpServer: HTTPServer): Server {
  const corsOrigin = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
    : 'http://localhost:3000';

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    path: '/ws',
  });

  const sessionNamespace = io.of(SESSION_NS);

  sessionNamespace.on('connection', (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId as string;

    if (sessionId) {
      socket.join(`session:${sessionId}`);
      logger.debug({ sessionId }, 'Socket: Client joined session namespace');
    }

    socket.on('subscribe', (id: string) => {
      socket.join(`session:${id}`);
      logger.debug({ sessionId: id }, 'Socket: Client subscribed to session');
    });

    socket.on('unsubscribe', (id: string) => {
      socket.leave(`session:${id}`);
    });

    socket.on('disconnect', () => {
      logger.debug('Socket: Client disconnected');
    });
  });

  logger.info('Socket.IO initialized on /ws/*');
  return io;
}

export function emitToSession(sessionId: string, event: string, data: unknown): void {
  if (!io) return;
  const sessionNamespace = io.of(SESSION_NS);
  sessionNamespace.to(`session:${sessionId}`).emit(event, data);
}

export function emitToAll(event: string, data: unknown): void {
  if (!io) return;
  const sessionNamespace = io.of(SESSION_NS);
  sessionNamespace.emit(event, data);
}

export function emitJobStarted(sessionId: string, data: {
  jobId: string; area: string; city: string; businessType: string;
  sources: string[]; queuePosition: number; totalJobs: number;
}): void {
  emitToSession(sessionId, 'job:started', {
    type: 'job:started',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitJobProgress(sessionId: string, data: {
  jobId: string; area: string; city: string; progress: string;
  totalLeads?: number; sourceResults?: Array<{ source: string; totalStored: number }>;
}): void {
  emitToSession(sessionId, 'job:progress', {
    type: 'job:progress',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitJobCompleted(sessionId: string, data: {
  jobId: string; area: string; city: string; totalLeads: number;
  duration: number; sources: string[];
}): void {
  emitToSession(sessionId, 'job:completed', {
    type: 'job:completed',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitJobFailed(sessionId: string, data: {
  jobId: string; area: string; city: string; error: string;
  duration: number;
}): void {
  emitToSession(sessionId, 'job:failed', {
    type: 'job:failed',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitSessionStatus(sessionId: string, status: string, data?: Record<string, unknown>): void {
  emitToSession(sessionId, 'session:status', {
    type: 'session:status',
    sessionId,
    timestamp: new Date().toISOString(),
    status,
    data: data || {},
  });
}

export function emitLogAdded(sessionId: string, logEntry: { timestamp: string; message: string; level: string }): void {
  emitToSession(sessionId, 'log:added', {
    type: 'log:added',
    sessionId,
    timestamp: new Date().toISOString(),
    data: logEntry,
  });
}

export function emitSearchStart(sessionId: string, data: {
  keyword: string; location: string; state?: string; city?: string; area?: string;
  sources: string[];
}): void {
  emitToSession(sessionId, 'search:start', {
    type: 'search:start',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitSearchProgress(sessionId: string, data: {
  foundCount: number;
  savedCount: number;
  duplicateCount: number;
  failedCount: number;
  progress: number;
  currentSource: string;
  currentLead: string;
  updatedAt: string;
}): void {
  emitToSession(sessionId, 'search:progress', {
    searchSessionId: sessionId,
    currentSource: data.currentSource,
    foundCount: data.foundCount,
    savedCount: data.savedCount,
    duplicateCount: data.duplicateCount,
    failedCount: data.failedCount,
    progress: data.progress,
    currentLead: data.currentLead,
    updatedAt: data.updatedAt,
  });
}

export function emitLeadFound(sessionId: string, data: {
  businessName: string; source: string; totalLeads: number;
}): void {
  emitToSession(sessionId, 'lead:found', {
    type: 'lead:found',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitSourceUpdate(sessionId: string, data: {
  source: string; count: number; status: 'searching' | 'completed' | 'failed';
}): void {
  emitToSession(sessionId, 'source:update', {
    type: 'source:update',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitSearchCompleted(sessionId: string, data: {
  keyword: string; location: string; totalLeads: number; uniqueLeads: number;
  duplicatesRemoved: number; sourceBreakdown: Record<string, number>;
  durationMs: number;
  state?: string;
  city?: string;
  area?: string;
  sources?: string[];
}): void {
  emitToSession(sessionId, 'search:completed', {
    type: 'search:completed',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitSearchHistoryUpdate(sessionId: string, data: {
  keyword: string; state?: string; city?: string; area?: string;
  sources: string[]; totalLeads: number; startedAt: string; completedAt: string;
  duration: number; status: string;
}): void {
  emitToAll('search:history-update', {
    type: 'search:history-update',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitSearchError(sessionId: string, data: {
  error: string;
}): void {
  emitToSession(sessionId, 'search:error', {
    type: 'search:error',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitSearchRecovered(sessionId: string, data: {
  keyword: string; location: string; state?: string; city?: string; area?: string;
  sources: string[]; leadsFound: number; uniqueLeads: number; duplicatesRemoved: number;
  failedCount: number; progressPercentage: number; elapsedMs: number;
}): void {
  emitToSession(sessionId, 'search:recovered', {
    type: 'search:recovered',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitLeadSaved(sessionId: string, data: {
  totalSaved: number;
}): void {
  emitToSession(sessionId, 'lead:saved', {
    type: 'lead:saved',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitDuplicateRemoved(sessionId: string, data: {
  totalDuplicates: number;
}): void {
  emitToSession(sessionId, 'duplicate:removed', {
    type: 'duplicate:removed',
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function emitEmailDiscoveryUpdate(leadId: string, data: {
  status: string;
  primaryEmail?: string;
  emailCount?: number;
  error?: string;
}): void {
  if (!io) return;
  io.emit('email:discovery:update', {
    type: 'email:discovery:update',
    leadId,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function getSocketIO(): Server | null {
  return io;
}
