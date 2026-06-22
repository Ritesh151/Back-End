import { scraperEngine } from './scraper-engine';
import { logger } from '../../utils/logger';
import { AreaJobModel, AreaSessionModel } from '../../automation/area-automation.model';
import type { IAreaJobDocument } from '../../automation/area-automation.model';
import type { AreaAutomationSourceResult } from '../../automation/area-automation.types';
import { monitorEngine } from '../../modules/automation-monitor/monitor-engine';
import { semanticSearchService } from '../../services/semantic-search.service';

const MAX_RETRIES = 2;

export class AreaQueue {
  private processingSessions: Set<string> = new Set();
  private activeJobBySession: Map<string, string> = new Map();
  private stopRequestedBySession: Map<string, boolean> = new Map();

  async enqueueJobs(sessionId: string, jobs: Array<{
    businessType: string;
    state: string;
    city: string;
    area: string;
    sources: string[];
  }>): Promise<void> {
    const docs = jobs.map((job, index) => ({
      sessionId,
      businessType: job.businessType,
      state: job.state,
      city: job.city,
      area: job.area,
      sources: job.sources,
      status: 'pending' as const,
      progress: '',
      totalLeads: 0,
      sourceResults: [],
      startedAt: null,
      completedAt: null,
      failedReason: null,
      queuePosition: index + 1,
      totalJobs: jobs.length,
    }));

    await AreaJobModel.insertMany(docs);
    logger.info({ sessionId, count: jobs.length }, 'AreaQueue: Jobs enqueued');
  }

  async startProcessing(sessionId: string): Promise<void> {
    if (this.processingSessions.has(sessionId)) {
      logger.warn({ sessionId }, 'AreaQueue: Session already processing');
      return;
    }

    this.processingSessions.add(sessionId);
    this.stopRequestedBySession.set(sessionId, false);
    logger.info({ sessionId }, 'AreaQueue: Started processing');

    try {
      while (!this.stopRequestedBySession.get(sessionId)) {
        const nextJob = await AreaJobModel.findOneAndUpdate(
          { sessionId, status: 'pending' },
          { $set: { status: 'running', startedAt: new Date(), progress: 'Starting...' } },
          { sort: { queuePosition: 1 }, new: true }
        );

        if (!nextJob) {
          logger.info({ sessionId }, 'AreaQueue: No more pending jobs');
          break;
        }

        this.activeJobBySession.set(sessionId, nextJob._id.toString());

        await AreaSessionModel.updateOne(
          { _id: sessionId },
          { $inc: { runningJobs: 1 } }
        );

        logger.info({
          sessionId, jobId: nextJob._id,
          businessType: nextJob.businessType, area: nextJob.area, city: nextJob.city,
          queuePosition: nextJob.queuePosition, totalJobs: nextJob.totalJobs,
        }, 'AreaQueue: Processing job');

        monitorEngine.onJobStarted({
          _id: nextJob._id.toString(),
          sessionId: nextJob.sessionId,
          businessType: nextJob.businessType,
          state: nextJob.state,
          city: nextJob.city,
          area: nextJob.area,
          sources: nextJob.sources,
          queuePosition: nextJob.queuePosition,
          totalJobs: nextJob.totalJobs,
        });

        let lastError: string | null = null;
        let success = false;

        for (let attempt = 0; attempt <= MAX_RETRIES && !success; attempt++) {
          if (attempt > 0) {
            logger.info({
              sessionId, jobId: nextJob._id, attempt,
              businessType: nextJob.businessType, area: nextJob.area,
            }, 'AreaQueue: Retrying job');
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }

          try {
            await this.processJob(nextJob);
            success = true;
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({
              err: lastError, sessionId, jobId: nextJob._id, attempt,
              businessType: nextJob.businessType, area: nextJob.area,
            }, 'AreaQueue: Attempt failed');
          }
        }

        if (success) {
          await AreaJobModel.findByIdAndUpdate(nextJob._id, {
            $set: {
              status: 'completed',
              completedAt: new Date(),
            },
          });
          await AreaSessionModel.updateOne(
            { _id: sessionId },
            { $inc: { completedJobs: 1, runningJobs: -1 } }
          );

          const jobDoc = await AreaJobModel.findById(nextJob._id).lean();
          monitorEngine.onJobCompleted({
            _id: nextJob._id.toString(),
            sessionId,
            area: nextJob.area,
            city: nextJob.city,
            businessType: nextJob.businessType,
            sources: nextJob.sources,
            totalLeads: jobDoc?.totalLeads || 0,
            sourceResults: (jobDoc?.sourceResults || []).map(sr => ({
              source: sr.source,
              totalStored: sr.totalStored,
            })),
          });
        } else {
          await AreaJobModel.findByIdAndUpdate(nextJob._id, {
            $set: {
              status: 'failed',
              completedAt: new Date(),
              progress: `Failed: ${lastError || 'Unknown error'}`,
              failedReason: lastError || 'Unknown error',
            },
          });
          await AreaSessionModel.updateOne(
            { _id: sessionId },
            { $inc: { failedJobs: 1, runningJobs: -1 } }
          );

          monitorEngine.onJobFailed({
            _id: nextJob._id.toString(),
            sessionId,
            area: nextJob.area,
            city: nextJob.city,
            businessType: nextJob.businessType,
            error: lastError || 'Unknown error',
          });

          logger.error({
            err: lastError, sessionId, jobId: nextJob._id,
            businessType: nextJob.businessType, area: nextJob.area,
          }, 'AreaQueue: Job failed after retries');
        }

        this.activeJobBySession.delete(sessionId);

        if (this.stopRequestedBySession.get(sessionId)) {
          logger.info({ sessionId }, 'AreaQueue: Stop requested, breaking');
          break;
        }
      }

      if (!this.stopRequestedBySession.get(sessionId)) {
        await AreaSessionModel.updateOne(
          { _id: sessionId },
          { $set: { status: 'completed', completedAt: new Date() } }
        );
        logger.info({ sessionId }, 'AreaQueue: All jobs completed');
        monitorEngine.onSessionCompleted(sessionId);
      } else {
        await AreaJobModel.updateMany(
          { sessionId, status: { $in: ['pending', 'running'] } },
          { $set: { status: 'skipped', progress: 'Skipped - automation stopped' } }
        );
        await AreaSessionModel.findByIdAndUpdate(sessionId, {
          $set: { status: 'completed', completedAt: new Date() },
        });
        logger.info({ sessionId }, 'AreaQueue: Automation stopped');
        monitorEngine.onSessionStopped(sessionId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Queue processing error';
      logger.error({ err: message, sessionId }, 'AreaQueue: Processing error');
    } finally {
      this.processingSessions.delete(sessionId);
      this.activeJobBySession.delete(sessionId);
      this.stopRequestedBySession.delete(sessionId);
      logger.info({ sessionId }, 'AreaQueue: Processing finished');
    }
  }

  private async processJob(job: IAreaJobDocument): Promise<void> {
    const { sessionId, businessType, state, city, area, sources } = job;
    const locationStr = `${area}, ${city}, ${state}`;

    logger.info({
      action: 'area_scrape_started',
      sessionId, businessType, city, area,
    }, 'AreaQueue: Job started');

    await AreaJobModel.findByIdAndUpdate(job._id, {
      $set: { progress: `Scraping ${businessType} in ${area}...` },
    });

    const expanded = semanticSearchService.expandWithAIFallback(businessType, sources, state, city, area);
    const expandedKeywords = expanded.expandedKeywords.map(ek => ek.keyword);
    const semanticKeyword = expandedKeywords.length > 1 ? expandedKeywords.join(', ') : undefined;

    const result = await scraperEngine.scrapeMultiSource({
      keyword: businessType,
      location: locationStr,
      sources,
      limit: 100,
      state,
      city,
      area,
      businessType,
      sessionId,
      semanticExpansion: expandedKeywords.length > 1,
      semanticKeyword,
    });

    const sourceResults: AreaAutomationSourceResult[] = [];
    let totalStored = 0;

    for (const sr of result.sourceResults) {
      sourceResults.push({
        source: sr.source,
        totalStored: sr.totalStored,
        totalExtracted: sr.totalExtracted,
        totalDuplicates: sr.totalDuplicates,
        success: sr.success,
      });
      totalStored += sr.totalStored;
    }

    await AreaJobModel.findByIdAndUpdate(job._id, {
      $set: {
        totalLeads: totalStored,
        sourceResults,
        progress: `Completed - ${totalStored} leads from ${sources.length} sources`,
      },
    });

    await AreaSessionModel.updateOne(
      { _id: sessionId },
      { $inc: { totalLeads: totalStored } }
    );

    monitorEngine.onJobProgress({
      _id: job._id.toString(),
      sessionId,
      area: job.area,
      city: job.city,
      progress: `Completed - ${totalStored} leads from ${sources.length} sources`,
      totalLeads: totalStored,
      sourceResults: sourceResults.map(sr => ({
        source: sr.source,
        totalStored: sr.totalStored,
      })),
    });

    logger.info({
      action: 'area_scrape_completed',
      sessionId, businessType, city, area,
      totalStored, sources: sources.length,
    }, 'AreaQueue: Job processing done');
  }

  async stopProcessing(sessionId?: string): Promise<void> {
    if (sessionId) {
      this.stopRequestedBySession.set(sessionId, true);
      const activeJobId = this.activeJobBySession.get(sessionId);
      if (activeJobId) {
        await AreaJobModel.findByIdAndUpdate(activeJobId, {
          $set: { status: 'pending', progress: 'Paused', startedAt: null },
        });
      }
      this.activeJobBySession.delete(sessionId);
      logger.info({ sessionId }, 'AreaQueue: Stopped');
    } else {
      this.stopRequestedBySession.forEach((_, sid) => {
        this.stopRequestedBySession.set(sid, true);
      });
      this.activeJobBySession.forEach(async (jobId) => {
        await AreaJobModel.findByIdAndUpdate(jobId, {
          $set: { status: 'pending', progress: 'Paused', startedAt: null },
        });
      });
      this.activeJobBySession.clear();
      logger.info('AreaQueue: Stopped all sessions');
    }
  }

  isProcessing(sessionId?: string): boolean {
    if (sessionId) return this.processingSessions.has(sessionId);
    return this.processingSessions.size > 0;
  }

  getActiveJobId(sessionId: string): string | null {
    return this.activeJobBySession.get(sessionId) || null;
  }

  async getStatus(): Promise<{
    sessionsProcessing: number;
    sessions: Array<{ sessionId: string; activeJobId: string | null }>;
  }> {
    const sessions = Array.from(this.processingSessions).map(sessionId => ({
      sessionId,
      activeJobId: this.activeJobBySession.get(sessionId) || null,
    }));
    return { sessionsProcessing: this.processingSessions.size, sessions };
  }
}

export const areaQueue = new AreaQueue();
