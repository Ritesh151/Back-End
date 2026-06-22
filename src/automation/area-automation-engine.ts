import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { AreaSessionModel, AreaJobModel } from './area-automation.model';
import { areaIterator } from './area-iterator';
import { areaQueue } from '../core/scraper-engine/area-queue';
import type { IAreaAutomationSession, IAreaAutomationJob, StartAutomationRequest, SessionSummary, AreaAutomationProgress, SessionFilterOptions } from './area-automation.types';

export class AreaAutomationEngine {
  async startAutomation(req: StartAutomationRequest): Promise<IAreaAutomationSession> {
    const { businessTypes, state, cities, sources, name, maxLeads, concurrency, retryEnabled, dedupEnabled, aiAuditEnabled, autoOutreach, autoReport, autoWhatsApp, schedule, frequency } = req;
    const sessionId = randomUUID();

    const iterations = areaIterator.iterate(state, cities);
    const totalJobs = iterations.length * businessTypes.length;

    if (totalJobs === 0) {
      throw new Error('No jobs generated - check that the selected cities have areas defined');
    }

    const session = await AreaSessionModel.create({
      _id: sessionId,
      name: name || `${businessTypes[0]} - ${state} - ${cities.join(', ')}`,
      businessTypes,
      state,
      cities,
      sources,
      status: 'running',
      totalJobs,
      completedJobs: 0,
      failedJobs: 0,
      runningJobs: 0,
      skippedJobs: 0,
      totalLeads: 0,
      startedAt: new Date(),
      completedAt: null,
      pausedAt: null,
      archivedAt: null,
      retryCount: 0,
      lastRunAt: new Date(),
      maxLeads: maxLeads || 100,
      concurrency: concurrency || 2,
      retryEnabled: retryEnabled !== undefined ? retryEnabled : true,
      dedupEnabled: dedupEnabled !== undefined ? dedupEnabled : true,
      aiAuditEnabled: aiAuditEnabled || false,
      autoOutreach: autoOutreach || false,
      autoReport: autoReport || false,
      autoWhatsApp: autoWhatsApp || false,
      schedule: schedule || '',
      frequency: frequency || 'once',
    });

    logger.info({ sessionId, businessTypes, state, cities, sources, totalJobs }, 'Engine: Automation session created');

    const jobs: Array<{
      businessType: string;
      state: string;
      city: string;
      area: string;
      sources: string[];
    }> = [];

    for (const { city, area } of iterations) {
      for (const businessType of businessTypes) {
        jobs.push({ businessType, state, city, area, sources });
      }
    }

    await areaQueue.enqueueJobs(sessionId, jobs);
    logger.info({ sessionId, jobCount: jobs.length }, 'Engine: Jobs enqueued');

    setImmediate(() => {
      areaQueue.startProcessing(sessionId).catch((err) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), sessionId }, 'Engine: Queue processing failed');
      });
    });

    return this.toSessionDTO(session);
  }

  async saveDraft(req: StartAutomationRequest): Promise<IAreaAutomationSession> {
    const { businessTypes, state, cities, sources, name, maxLeads, concurrency, retryEnabled, dedupEnabled, aiAuditEnabled, autoOutreach, autoReport, autoWhatsApp, schedule, frequency } = req;
    const sessionId = randomUUID();

    const session = await AreaSessionModel.create({
      _id: sessionId,
      name: name || `${(businessTypes && businessTypes[0]) || 'New'} - Draft`,
      businessTypes: businessTypes || [],
      state: state || '',
      cities: cities || [],
      sources: sources || [],
      status: 'draft',
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      runningJobs: 0,
      skippedJobs: 0,
      totalLeads: 0,
      startedAt: null,
      completedAt: null,
      pausedAt: null,
      archivedAt: null,
      retryCount: 0,
      lastRunAt: null,
      maxLeads: maxLeads || 100,
      concurrency: concurrency || 2,
      retryEnabled: retryEnabled !== undefined ? retryEnabled : true,
      dedupEnabled: dedupEnabled !== undefined ? dedupEnabled : true,
      aiAuditEnabled: aiAuditEnabled || false,
      autoOutreach: autoOutreach || false,
      autoReport: autoReport || false,
      autoWhatsApp: autoWhatsApp || false,
      schedule: schedule || '',
      frequency: frequency || 'once',
    });

    logger.info({ sessionId }, 'Engine: Draft automation saved');
    return this.toSessionDTO(session);
  }

  async getSession(sessionId: string): Promise<IAreaAutomationSession | null> {
    const session = await AreaSessionModel.findById(sessionId);
    return session ? this.toSessionDTO(session) : null;
  }

  async getJobs(
    sessionId: string,
    status?: string,
    businessType?: string,
    city?: string
  ): Promise<IAreaAutomationJob[]> {
    const query: Record<string, unknown> = { sessionId };
    if (status) query.status = status;
    if (businessType) query.businessType = businessType;
    if (city) query.city = city;

    const docs = await AreaJobModel.find(query).sort({ queuePosition: 1 }).lean();
    return docs.map((d) => this.toJobDTO(d));
  }

  async getProgress(sessionId: string): Promise<AreaAutomationProgress | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const jobs = await this.getJobs(sessionId);
    const summary = this.calculateSummary(session, jobs, jobs.length);

    await this.checkSessionCompletion(sessionId, summary);

    return { session, jobs, summary };
  }

  async getRecentSessions(limit = 10): Promise<IAreaAutomationSession[]> {
    const docs = await AreaSessionModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d: Record<string, unknown>) => this.toSessionDTO(d));
  }

  async getSessionsWithFilters(filters: SessionFilterOptions): Promise<{ sessions: IAreaAutomationSession[]; total: number }> {
    const { status, search, source, state, city, sortBy = 'createdAt', sortOrder = 'desc', limit = 10, offset = 0 } = filters;
    const query: Record<string, unknown> = {};

    if (status) query.status = status;
    if (source) query.sources = source;
    if (state) query.state = state;
    if (city) query.cities = city;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { businessTypes: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { cities: { $regex: search, $options: 'i' } },
      ];
    }

    const sortField = sortBy === 'totalLeads' ? 'totalLeads' : sortBy === 'status' ? 'status' : 'createdAt';
    const sortObj: Record<string, 1 | -1> = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const [docs, total] = await Promise.all([
      AreaSessionModel.find(query).sort(sortObj).skip(offset).limit(limit).lean(),
      AreaSessionModel.countDocuments(query),
    ]);

    const sessionIds = docs.map((d: Record<string, unknown>) => (d._id || d.id) as string);
    let totalLeadsMap = new Map<string, number>();
    if (sessionIds.length > 0) {
      const jobAgg = await AreaJobModel.aggregate([
        { $match: { sessionId: { $in: sessionIds } } },
        { $group: { _id: '$sessionId', totalLeads: { $sum: '$totalLeads' } } },
      ]);
      totalLeadsMap = new Map(jobAgg.map(j => [j._id, j.totalLeads]));
    }

    const sessions = docs.map((d: Record<string, unknown>) => {
      const dto = this.toSessionDTO(d);
      const fromJobs = totalLeadsMap.get(dto.id);
      if (fromJobs !== undefined) {
        dto.totalLeads = fromJobs;
      }
      return dto;
    });

    return { sessions, total };
  }

  async updateSession(sessionId: string, updates: Partial<StartAutomationRequest>): Promise<IAreaAutomationSession | null> {
    const setFields: Record<string, unknown> = {};

    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.businessTypes !== undefined) setFields.businessTypes = updates.businessTypes;
    if (updates.state !== undefined) setFields.state = updates.state;
    if (updates.cities !== undefined) setFields.cities = updates.cities;
    if (updates.sources !== undefined) setFields.sources = updates.sources;
    if (updates.maxLeads !== undefined) setFields.maxLeads = updates.maxLeads;
    if (updates.concurrency !== undefined) setFields.concurrency = updates.concurrency;
    if (updates.retryEnabled !== undefined) setFields.retryEnabled = updates.retryEnabled;
    if (updates.dedupEnabled !== undefined) setFields.dedupEnabled = updates.dedupEnabled;
    if (updates.aiAuditEnabled !== undefined) setFields.aiAuditEnabled = updates.aiAuditEnabled;
    if (updates.autoOutreach !== undefined) setFields.autoOutreach = updates.autoOutreach;
    if (updates.autoReport !== undefined) setFields.autoReport = updates.autoReport;
    if (updates.autoWhatsApp !== undefined) setFields.autoWhatsApp = updates.autoWhatsApp;
    if (updates.schedule !== undefined) setFields.schedule = updates.schedule;
    if (updates.frequency !== undefined) setFields.frequency = updates.frequency;

    const doc = await AreaSessionModel.findByIdAndUpdate(
      sessionId,
      { $set: setFields },
      { new: true }
    );

    return doc ? this.toSessionDTO(doc) : null;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await AreaJobModel.deleteMany({ sessionId });
    const result = await AreaSessionModel.findByIdAndDelete(sessionId);
    logger.info({ sessionId }, 'Engine: Automation deleted');
    return !!result;
  }

  async duplicateSession(sessionId: string): Promise<IAreaAutomationSession | null> {
    const original = await AreaSessionModel.findById(sessionId).lean();
    if (!original) return null;

    const newId = randomUUID();
    const { _id, createdAt, updatedAt, completedAt, pausedAt, archivedAt, lastRunAt, ...data } = original as Record<string, unknown>;

    const newSession = await AreaSessionModel.create({
      _id: newId,
      ...data,
      name: `${data.name || 'Automation'} (Copy)`,
      status: 'draft',
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      runningJobs: 0,
      skippedJobs: 0,
      totalLeads: 0,
      startedAt: null,
      completedAt: null,
      pausedAt: null,
      archivedAt: null,
      lastRunAt: null,
    });

    logger.info({ originalId: sessionId, newId }, 'Engine: Automation duplicated');
    return this.toSessionDTO(newSession);
  }

  async archiveSession(sessionId: string): Promise<IAreaAutomationSession | null> {
    const doc = await AreaSessionModel.findByIdAndUpdate(
      sessionId,
      { $set: { status: 'archived', archivedAt: new Date() } },
      { new: true }
    );
    return doc ? this.toSessionDTO(doc) : null;
  }

  async stopAutomation(sessionId: string): Promise<IAreaAutomationSession | null> {
    await areaQueue.stopProcessing(sessionId);
    await AreaJobModel.updateMany(
      { sessionId, status: { $in: ['pending', 'running'] } },
      { $set: { status: 'skipped', progress: 'Skipped - automation stopped' } }
    );
    const doc = await AreaSessionModel.findByIdAndUpdate(
      sessionId,
      { $set: { status: 'completed', completedAt: new Date() } },
      { new: true }
    );
    logger.info({ sessionId }, 'Engine: Automation stopped');
    return doc ? this.toSessionDTO(doc) : null;
  }

  async pauseAutomation(sessionId: string): Promise<IAreaAutomationSession | null> {
    await areaQueue.stopProcessing(sessionId);
    const doc = await AreaSessionModel.findByIdAndUpdate(
      sessionId,
      { $set: { status: 'paused', pausedAt: new Date() } },
      { new: true }
    );
    logger.info({ sessionId }, 'Engine: Automation paused');
    return doc ? this.toSessionDTO(doc) : null;
  }

  async resumeAutomation(sessionId: string): Promise<IAreaAutomationSession> {
    const session = await AreaSessionModel.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const skippedCount = await AreaJobModel.countDocuments({ sessionId, status: 'skipped' });
    const pendingCount = await AreaJobModel.countDocuments({ sessionId, status: 'pending' });

    if (skippedCount === 0 && pendingCount === 0) {
      throw new Error('No recoverable jobs found. All jobs are already completed or failed.');
    }

    logger.info({ sessionId, skippedCount, pendingCount }, 'Engine: Resuming automation');

    await AreaJobModel.updateMany(
      { sessionId, status: 'skipped' },
      { $set: { status: 'pending', progress: '', startedAt: null, completedAt: null, failedReason: null } }
    );

    await AreaSessionModel.findByIdAndUpdate(sessionId, {
      $set: {
        status: 'running',
        completedAt: null,
        pausedAt: null,
        runningJobs: 0,
        lastRunAt: new Date(),
      },
    });

    setImmediate(() => {
      areaQueue.startProcessing(sessionId).catch((err) => {
        logger.error({ err: err instanceof Error ? err.message : String(err), sessionId }, 'Engine: Resume queue processing failed');
      });
    });

    const updatedSession = await AreaSessionModel.findById(sessionId);
    if (!updatedSession) {
      throw new Error('Session not found after resume');
    }
    logger.info({ sessionId, skippedRecovered: skippedCount }, 'Engine: Automation resumed');
    return this.toSessionDTO(updatedSession);
  }

  async restartAutomation(sessionId: string): Promise<IAreaAutomationSession | null> {
    await areaQueue.stopProcessing(sessionId);

    await AreaJobModel.updateMany(
      { sessionId },
      { $set: { status: 'pending', progress: '', startedAt: null, completedAt: null, failedReason: null } }
    );

    const doc = await AreaSessionModel.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          status: 'running',
          completedJobs: 0,
          failedJobs: 0,
          runningJobs: 0,
          skippedJobs: 0,
          totalLeads: 0,
          startedAt: new Date(),
          completedAt: null,
          pausedAt: null,
          lastRunAt: new Date(),
        },
      },
      { new: true }
    );

    if (doc) {
      setImmediate(() => {
        areaQueue.startProcessing(sessionId).catch((err) => {
          logger.error({ err: err instanceof Error ? err.message : String(err), sessionId }, 'Engine: Restart queue processing failed');
        });
      });
    }

    return doc ? this.toSessionDTO(doc) : null;
  }

  async getStats(): Promise<{
    total: number;
    running: number;
    completed: number;
    failed: number;
    paused: number;
    draft: number;
    totalLeads: number;
  }> {
    const [total, running, completed, failed, paused, draft, jobLeadResult] = await Promise.all([
      AreaSessionModel.countDocuments(),
      AreaSessionModel.countDocuments({ status: 'running' }),
      AreaSessionModel.countDocuments({ status: 'completed' }),
      AreaSessionModel.countDocuments({ status: 'failed' }),
      AreaSessionModel.countDocuments({ status: 'paused' }),
      AreaSessionModel.countDocuments({ status: 'draft' }),
      AreaJobModel.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalLeads: { $sum: '$totalLeads' } } },
      ]),
    ]);

    return {
      total,
      running,
      completed,
      failed,
      paused,
      draft,
      totalLeads: jobLeadResult[0]?.totalLeads || 0,
    };
  }

  private async checkSessionCompletion(
    sessionId: string,
    summary: SessionSummary
  ): Promise<void> {
    if (summary.pendingJobs === 0 && summary.runningJobs === 0) {
      const status = summary.failedJobs > 0 && summary.completedJobs === 0 ? 'failed' : 'completed';
      await AreaSessionModel.findByIdAndUpdate(sessionId, {
        $set: { status, completedAt: new Date() },
      });
      logger.info({ sessionId, status, summary }, 'Engine: Session completed');
    }
  }

  private calculateSummary(
    session: IAreaAutomationSession,
    jobs: IAreaAutomationJob[],
    totalJobCount: number
  ): SessionSummary {
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;
    const runningJobs = jobs.filter(j => j.status === 'running').length;
    const skippedJobs = jobs.filter(j => j.status === 'skipped').length;
    const pendingJobs = totalJobCount - completedJobs - failedJobs - runningJobs - skippedJobs;
    const totalLeads = jobs.reduce((sum, j) => sum + j.totalLeads, 0);

    return {
      totalJobs: totalJobCount,
      completedJobs,
      failedJobs,
      runningJobs,
      pendingJobs: Math.max(0, pendingJobs),
      skippedJobs,
      totalLeads,
      businessTypesCount: session.businessTypes.length,
    };
  }

  private toSessionDTO(doc: unknown): IAreaAutomationSession {
    const d = doc as Record<string, unknown>;
    return {
      id: (d._id || d.id) as string,
      name: (d.name as string) || '',
      businessTypes: d.businessTypes as string[],
      state: d.state as string,
      cities: d.cities as string[],
      sources: d.sources as string[],
      status: d.status as IAreaAutomationSession['status'],
      totalJobs: d.totalJobs as number,
      completedJobs: d.completedJobs as number,
      failedJobs: d.failedJobs as number,
      runningJobs: d.runningJobs as number,
      skippedJobs: d.skippedJobs as number,
      totalLeads: d.totalLeads as number,
      startedAt: d.startedAt ? new Date(d.startedAt as Date).toISOString() : null,
      completedAt: d.completedAt ? new Date(d.completedAt as Date).toISOString() : null,
      pausedAt: d.pausedAt ? new Date(d.pausedAt as Date).toISOString() : null,
      archivedAt: d.archivedAt ? new Date(d.archivedAt as Date).toISOString() : null,
      retryCount: (d.retryCount as number) || 0,
      lastRunAt: d.lastRunAt ? new Date(d.lastRunAt as Date).toISOString() : null,
      maxLeads: (d.maxLeads as number) || 100,
      concurrency: (d.concurrency as number) || 2,
      retryEnabled: (d.retryEnabled as boolean) !== false,
      dedupEnabled: (d.dedupEnabled as boolean) !== false,
      aiAuditEnabled: (d.aiAuditEnabled as boolean) || false,
      autoOutreach: (d.autoOutreach as boolean) || false,
      autoReport: (d.autoReport as boolean) || false,
      autoWhatsApp: (d.autoWhatsApp as boolean) || false,
      schedule: (d.schedule as string) || '',
      frequency: (d.frequency as string) || 'once',
      createdAt: new Date(d.createdAt as Date).toISOString(),
      updatedAt: new Date(d.updatedAt as Date).toISOString(),
    };
  }

  private toJobDTO(doc: unknown): IAreaAutomationJob {
    const d = doc as Record<string, unknown>;
    return {
      id: (d._id || d.id) as string,
      sessionId: d.sessionId as string,
      businessType: d.businessType as string,
      state: d.state as string,
      city: d.city as string,
      area: d.area as string,
      sources: d.sources as string[],
      status: d.status as IAreaAutomationJob['status'],
      progress: d.progress as string,
      totalLeads: d.totalLeads as number,
      sourceResults: d.sourceResults as IAreaAutomationJob['sourceResults'],
      startedAt: d.startedAt ? new Date(d.startedAt as Date).toISOString() : null,
      completedAt: d.completedAt ? new Date(d.completedAt as Date).toISOString() : null,
      failedReason: d.failedReason as string | null,
      queuePosition: d.queuePosition as number,
      totalJobs: d.totalJobs as number,
      createdAt: new Date(d.createdAt as Date).toISOString(),
      updatedAt: new Date(d.updatedAt as Date).toISOString(),
    };
  }
}

export const areaAutomationEngine = new AreaAutomationEngine();
