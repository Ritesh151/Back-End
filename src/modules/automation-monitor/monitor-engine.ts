import { ExecutionLogModel } from './execution-log.model';
import { AreaJobModel } from '../../automation/area-automation.model';
import { logger } from '../../utils/logger';
import {
  emitJobStarted, emitJobProgress, emitJobCompleted, emitJobFailed,
  emitSessionStatus, emitLogAdded,
} from './socket-manager';
import type { IExecutionLog, MonitorStats, SessionLiveStatus, MonitorLogEntry } from './monitor.types';

function nowISO(): string {
  return new Date().toISOString();
}

function makeLog(message: string, level: MonitorLogEntry['level'] = 'info'): MonitorLogEntry {
  return { timestamp: nowISO(), message, level };
}

export class MonitorEngine {
  private sessionMemoryLogs: Map<string, MonitorLogEntry[]> = new Map();
  private sessionStartTime: Map<string, number> = new Map();

  async onJobStarted(job: {
    _id: string; sessionId: string; businessType: string;
    state: string; city: string; area: string; sources: string[];
    queuePosition: number; totalJobs: number;
  }): Promise<void> {
    const now = new Date();
    if (!this.sessionStartTime.has(job.sessionId)) {
      this.sessionStartTime.set(job.sessionId, now.getTime());
    }

    const logEntry = makeLog(`Starting ${job.businessType} in ${job.area}, ${job.city} (${job.sources.join(', ')})`, 'info');

    try {
      await ExecutionLogModel.create({
        sessionId: job.sessionId,
        jobId: job._id,
        state: job.state,
        city: job.city,
        area: job.area,
        businessType: job.businessType,
        sources: job.sources,
        status: 'running',
        totalLeads: 0,
        sourceResults: [],
        startedAt: now,
        completedAt: null,
        duration: null,
        error: null,
        workerId: job.sessionId,
        logs: [logEntry],
      });
    } catch (err) {
      logger.error({ err, sessionId: job.sessionId }, 'MonitorEngine: Failed to create execution log');
    }

    this.addToMemoryLog(job.sessionId, logEntry);
    emitLogAdded(job.sessionId, logEntry);

    emitJobStarted(job.sessionId, {
      jobId: job._id,
      area: job.area,
      city: job.city,
      businessType: job.businessType,
      sources: job.sources,
      queuePosition: job.queuePosition,
      totalJobs: job.totalJobs,
    });

    emitSessionStatus(job.sessionId, 'running');
  }

  async onJobProgress(job: {
    _id: string; sessionId: string; area: string; city: string;
    progress: string; totalLeads?: number;
    sourceResults?: Array<{ source: string; totalStored: number }>;
  }): Promise<void> {
    const logEntry = makeLog(job.progress, 'info');
    this.addToMemoryLog(job.sessionId, logEntry);

    await ExecutionLogModel.updateOne(
      { jobId: job._id },
      {
        $push: { logs: logEntry },
        $set: {
          totalLeads: job.totalLeads ?? 0,
          sourceResults: job.sourceResults ?? [],
        },
      }
    );

    emitLogAdded(job.sessionId, logEntry);
    emitJobProgress(job.sessionId, {
      jobId: job._id,
      area: job.area,
      city: job.city,
      progress: job.progress,
      totalLeads: job.totalLeads,
      sourceResults: job.sourceResults,
    });
  }

  async onJobCompleted(job: {
    _id: string; sessionId: string; area: string; city: string;
    businessType: string; sources: string[];
    totalLeads: number; sourceResults: Array<{ source: string; totalStored: number }>;
  }): Promise<void> {
    const now = new Date();
    const logEntry = makeLog(
      `Completed ${job.businessType} in ${job.area}, ${job.city}: ${job.totalLeads} leads from ${job.sources.length} sources`,
      'success'
    );

    const startDoc = await ExecutionLogModel.findOne({ jobId: job._id }, { startedAt: 1 });
    const duration = startDoc?.startedAt
      ? now.getTime() - startDoc.startedAt.getTime()
      : 0;

    await ExecutionLogModel.updateOne(
      { jobId: job._id },
      {
        $push: { logs: logEntry },
        $set: {
          status: 'completed',
          completedAt: now,
          duration,
          totalLeads: job.totalLeads,
          sourceResults: job.sourceResults,
        },
      }
    );

    this.addToMemoryLog(job.sessionId, logEntry);
    emitLogAdded(job.sessionId, logEntry);

    emitJobCompleted(job.sessionId, {
      jobId: job._id,
      area: job.area,
      city: job.city,
      totalLeads: job.totalLeads,
      duration,
      sources: job.sources,
    });
  }

  async onJobFailed(job: {
    _id: string; sessionId: string; area: string; city: string;
    businessType: string; error: string;
  }): Promise<void> {
    const now = new Date();
    const logEntry = makeLog(
      `Failed ${job.businessType} in ${job.area}, ${job.city}: ${job.error}`,
      'error'
    );

    const startDoc = await ExecutionLogModel.findOne({ jobId: job._id }, { startedAt: 1 });
    const duration = startDoc?.startedAt
      ? now.getTime() - startDoc.startedAt.getTime()
      : 0;

    await ExecutionLogModel.updateOne(
      { jobId: job._id },
      {
        $push: { logs: logEntry },
        $set: {
          status: 'failed',
          completedAt: now,
          duration,
          error: job.error,
        },
      }
    );

    this.addToMemoryLog(job.sessionId, logEntry);
    emitLogAdded(job.sessionId, logEntry);

    emitJobFailed(job.sessionId, {
      jobId: job._id,
      area: job.area,
      city: job.city,
      error: job.error,
      duration,
    });
  }

  onSessionCompleted(sessionId: string): void {
    const logEntry = makeLog('All jobs completed', 'success');
    this.addToMemoryLog(sessionId, logEntry);
    emitLogAdded(sessionId, logEntry);
    emitSessionStatus(sessionId, 'completed');
    this.sessionStartTime.delete(sessionId);
  }

  onSessionStopped(sessionId: string): void {
    const logEntry = makeLog('Automation stopped by user', 'warn');
    this.addToMemoryLog(sessionId, logEntry);
    emitLogAdded(sessionId, logEntry);
    emitSessionStatus(sessionId, 'stopped');
    this.sessionStartTime.delete(sessionId);
  }

  async getLogs(sessionId: string, limit = 200): Promise<IExecutionLog[]> {
    const docs = await ExecutionLogModel.find({ sessionId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
    return docs.map(d => ({
      ...d,
      id: (d as any)._id.toString(),
      _id: undefined,
    })) as unknown as IExecutionLog[];
  }

  async getLiveStatus(sessionId: string): Promise<SessionLiveStatus | null> {
    const session = await (await import('../../automation/area-automation.model')).AreaSessionModel.findById(sessionId).lean();
    if (!session) return null;

    const activeJob = await AreaJobModel.findOne({ sessionId, status: 'running' }).sort({ startedAt: -1 }).lean();
    const totalJobs = await AreaJobModel.countDocuments({ sessionId });
    const processedJobs = await AreaJobModel.countDocuments({ sessionId, status: { $in: ['completed', 'failed'] } });

    const startTime = this.sessionStartTime.get(sessionId);
    const uptime = startTime ? Date.now() - startTime : 0;

    return {
      sessionId,
      status: session.status,
      currentJob: activeJob ? {
        id: (activeJob as any)._id.toString(),
        area: activeJob.area,
        city: activeJob.city,
        businessType: activeJob.businessType,
        progress: activeJob.progress,
        startedAt: activeJob.startedAt?.toISOString() ?? null,
        elapsed: activeJob.startedAt ? Date.now() - activeJob.startedAt.getTime() : 0,
      } : null,
      queueLength: totalJobs - processedJobs,
      processed: processedJobs,
      total: totalJobs,
      leadsFound: session.totalLeads,
      startedAt: session.startedAt?.toISOString() ?? null,
      uptime,
    };
  }

  async getStats(sessionId: string): Promise<MonitorStats> {
    const logs = await ExecutionLogModel.find({ sessionId }).lean();
    const jobs = await AreaJobModel.find({ sessionId }).lean();

    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;
    const runningJobs = jobs.filter(j => j.status === 'running').length;
    const pendingJobs = jobs.filter(j => j.status === 'pending').length;
    const totalLeads = logs.reduce((sum, l) => sum + (l.totalLeads || 0), 0);

    const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
    const completedLogs = logs.filter(l => l.status === 'completed');
    const avgJobDuration = completedLogs.length > 0
      ? Math.round(totalDuration / completedLogs.length)
      : 0;

    const leadsBySource: Record<string, number> = {};
    for (const log of logs) {
      for (const sr of log.sourceResults || []) {
        leadsBySource[sr.source] = (leadsBySource[sr.source] || 0) + (sr.totalStored || 0);
      }
    }

    const errorMap = new Map<string, { area: string; city: string; error: string; count: number }>();
    for (const log of logs) {
      if (log.status === 'failed' && log.error) {
        const key = `${log.city}:${log.area}`;
        const existing = errorMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          errorMap.set(key, {
            area: log.area,
            city: log.city,
            error: log.error,
            count: 1,
          });
        }
      }
    }

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      runningJobs,
      pendingJobs,
      totalLeads,
      totalDuration,
      avgJobDuration,
      leadsBySource,
      errorsByArea: Array.from(errorMap.values()),
    };
  }

  clearMemoryLogs(sessionId: string): void {
    this.sessionMemoryLogs.delete(sessionId);
    this.sessionStartTime.delete(sessionId);
  }

  getMemoryLogs(sessionId: string): MonitorLogEntry[] {
    return this.sessionMemoryLogs.get(sessionId) || [];
  }

  private addToMemoryLog(sessionId: string, entry: MonitorLogEntry): void {
    if (!this.sessionMemoryLogs.has(sessionId)) {
      this.sessionMemoryLogs.set(sessionId, []);
    }
    this.sessionMemoryLogs.get(sessionId)!.push(entry);
    if (this.sessionMemoryLogs.get(sessionId)!.length > 1000) {
      this.sessionMemoryLogs.get(sessionId)!.shift();
    }
  }
}

export const monitorEngine = new MonitorEngine();
