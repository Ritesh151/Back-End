import Redis from 'ioredis';
import { logger } from '../utils/logger';
import 'dotenv/config';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisService {
  private static instance: Redis;

  public static getInstance(): Redis {
    if (!RedisService.instance) {
      RedisService.instance = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      RedisService.instance.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      RedisService.instance.on('error', (err) => {
        logger.error({ err }, 'Redis connection error');
      });
    }

    return RedisService.instance;
  }
}

export const redisClient = RedisService.getInstance();
