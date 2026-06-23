
import { Queue } from 'bullmq';
import { redisClient } from '../config/redis';

export const SEARCH_QUEUE_NAME = 'search-jobs';



export const searchQueue = new Queue(SEARCH_QUEUE_NAME, {
  // @ts-ignore: BullMQ expects a different Redis client type
  connection: redisClient as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

