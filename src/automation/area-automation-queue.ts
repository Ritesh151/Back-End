import { scraperService } from '../services/scraper.service';
import { logger } from '../utils/logger';
import { AreaJobModel, AreaSessionModel } from './area-automation.model';
import type { IAreaJobDocument } from './area-automation.model';
import type { AreaAutomationSourceResult } from './area-automation.types';

const MAX_RETRIES = 2;

export class AreaAutomationQueue {
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
    logger.info({ sessionId, count: jobs.length }, 'Queue: Jobs enqueued');
  }

  async startProcessing(sessionId: string): Promise<void> {
    if (this.processingSessions.has(sessionId)) {
      logger.warn({ sessionId }, 'Queue: Session already processing, skipping');
      return;
    }

    this.processingSessions.add(sessionId);
    this.stopRequestedBySession.set(sessionId, false);
    logger.info({ sessionId, jobs: [] }, 'Queue: Started processing');

    try {
      while (!this.stopRequestedBySession.get(sessionId)) {
        const nextJob = await AreaJobModel.findOneAndUpdate(
          { sessionId, status: 'pending' },
          { $set: { status: 'running', startedAt: new Date(), progress: 'Starting...' } },
          { sort: { queuePosition: 1 }, new: true }
        );

        if (!nextJob) {
          logger.info({ sessionId }, 'Queue: No more pending jobs, finishing');
          break;
        }

        this.activeJobBySession.set(sessionId, nextJob._id.toString());

        await AreaSessionModel.updateOne(
          { _id: sessionId },
          { $inc: { runningJobs: 1 } }
        );

        logger.info({
          sessionId,
          jobId: nextJob._id,
          businessType: nextJob.businessType,
          area: nextJob.area,
          city: nextJob.city,
          queuePosition: nextJob.queuePosition,
          totalJobs: nextJob.totalJobs,
        }, 'Queue: Processing job');

        let lastError: string | null = null;
        let success = false;
        for (let attempt = 0; attempt <= MAX_RETRIES && !success; attempt++) {
          if (attempt > 0) {
            logger.info({
              sessionId, jobId: nextJob._id, attempt,
              businessType: nextJob.businessType,
              area: nextJob.area,
            }, 'Queue: Retrying job');
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
            }, 'Queue: Job attempt failed');
          }
        }

        if (!success) {
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

          logger.error({
            err: lastError, sessionId, jobId: nextJob._id,
            businessType: nextJob.businessType, area: nextJob.area,
          }, 'Queue: Job failed after all retries');
        }

        this.activeJobBySession.delete(sessionId);

        if (this.stopRequestedBySession.get(sessionId)) {
          logger.info({ sessionId }, 'Queue: Stop requested after completing current job');
          break;
        }
      }

      if (!this.stopRequestedBySession.get(sessionId)) {
        await AreaSessionModel.updateOne(
          { _id: sessionId },
          { $set: { status: 'completed', completedAt: new Date() } }
        );
        logger.info({ sessionId }, 'Queue: All jobs completed successfully');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Queue processing error';
      logger.error({ err: message, sessionId }, 'Queue: Processing error');
    } finally {
      this.processingSessions.delete(sessionId);
      this.activeJobBySession.delete(sessionId);
      this.stopRequestedBySession.delete(sessionId);
      logger.info({ sessionId }, 'Queue: Processing finished');
    }
  }

  private async processJob(job: IAreaJobDocument): Promise<void> {
    const { sessionId, businessType, state, city, area, sources } = job;
    const locationStr = `${area}, ${city}, ${state}`;

    logger.info({
      action: 'area_scrape_started',
      sessionId, businessType, city, area,
      searchQuery: `${businessType} in ${locationStr}`,
    }, 'Queue: Job started');

    await AreaJobModel.findByIdAndUpdate(job._id, {
      $set: { progress: `Scraping ${businessType} in ${area}...` },
    });

    const result = await scraperService.scrapeBusinesses({
      keyword: businessType,
      location: locationStr,
      sources,
      limit: 100,
      state,
      city,
      area,
      businessType,
      sessionId,
    });

    const sourceResults: AreaAutomationSourceResult[] = [];
    let totalStored = 0;

    for (const [sourceName, sourceResult] of Object.entries(result.results)) {
      sourceResults.push({
        source: sourceName,
        totalStored: sourceResult.totalStored,
        totalExtracted: sourceResult.totalExtracted,
        totalDuplicates: sourceResult.totalDuplicates,
        success: sourceResult.totalStored > 0,
      });
      totalStored += sourceResult.totalStored;

      logger.info({
        action: 'source_completed',
        source: sourceName,
        totalStored: sourceResult.totalStored,
        totalExtracted: sourceResult.totalExtracted,
        totalDuplicates: sourceResult.totalDuplicates,
      }, 'Queue: Source completed');
    }

    await AreaJobModel.findByIdAndUpdate(job._id, {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        progress: `Completed - ${totalStored} leads found`,
        totalLeads: totalStored,
        sourceResults,
      },
    });

    await AreaSessionModel.updateOne(
      { _id: sessionId },
      {
        $inc: { completedJobs: 1, totalLeads: totalStored, runningJobs: -1 },
      }
    );

    logger.info({
      action: 'area_scrape_completed',
      sessionId, businessType, city, area,
      totalStored, sources: sources.length,
    }, 'Queue: Job completed');
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
      logger.info({ sessionId }, 'Queue: Stopped processing for session');
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
      logger.info('Queue: Stopped all sessions');
    }
  }

  isProcessing(sessionId?: string): boolean {
    if (sessionId) {
      return this.processingSessions.has(sessionId);
    }
    return this.processingSessions.size > 0;
  }

  getActiveJobId(sessionId: string): string | null {
    return this.activeJobBySession.get(sessionId) || null;
  }
}

export const areaAutomationQueue = new AreaAutomationQueue();
