import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { ScraperService } from '../services/scraper.service';
import { logger } from '../utils/logger';
import { SEARCH_QUEUE_NAME } from '../queues/search.queue';
import { SearchAnalytics } from '../models/SearchAnalytics';

const scraperService = new ScraperService();

export const searchWorker = new Worker(
  SEARCH_QUEUE_NAME,
  async (job: Job) => {
    logger.info(`Processing search job ${job.id}`);
    const options = job.data;
    const startedAt = Date.now();

    try {
      // Simulate real-time progress updates natively through BullMQ
      await job.updateProgress({ stage: 'started', percent: 0, message: 'Starting search...' });
      
      const result = await scraperService.scrapeBusinesses(options);
      
      await job.updateProgress({ stage: 'completed', percent: 100, message: 'Search completed' });

      // Update analytics in background
      if (options.sessionId) {
        const count = result.totalStored || 0;
        await SearchAnalytics.findOneAndUpdate(
          { sessionId: options.sessionId },
          {
            $set: {
              status: 'completed',
              totalLeadsFound: result.totalExtracted || 0,
              totalUniqueLeads: count,
              totalDuplicatesRemoved: result.totalDuplicates || 0,
              duration: Date.now() - startedAt,
              completedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }

      logger.info(`Job ${job.id} completed. Found ${result.totalStored} leads.`);
      return result;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, 'Search worker failed');
      
      if (options.sessionId) {
        await SearchAnalytics.findOneAndUpdate(
          { sessionId: options.sessionId },
          { $set: { status: 'failed', failureReason: error instanceof Error ? error.message : 'Unknown error' } }
        );
      }

      throw error;
    }
  },
  {
    // @ts-ignore: BullMQ expects a different Redis client type
  connection: redisClient as any,
    concurrency: 5, // Process 5 searches simultaneously
  }
);

searchWorker.on('failed', (job, err) => {
  logger.error(`${job?.id} has failed with ${err.message}`);
});
