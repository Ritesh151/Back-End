import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error({ err: error, key }, 'Redis Cache Get Error');
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (error) {
      logger.error({ err: error, key }, 'Redis Cache Set Error');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error({ err: error, key }, 'Redis Cache Delete Error');
    }
  }

  async clear(): Promise<void> {
    try {
      await redisClient.flushdb();
    } catch (error) {
      logger.error({ err: error }, 'Redis Cache Clear Error');
    }
  }
}

export const cacheService = new CacheService();
