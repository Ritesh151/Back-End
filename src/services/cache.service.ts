import { logger } from '../utils/logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = this.cache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      return entry.data as T;
    } catch (error) {
      logger.error({ err: error, key }, 'Cache Get Error');
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    } catch (error) {
      logger.error({ err: error, key }, 'Cache Set Error');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.cache.delete(key);
    } catch (error) {
      logger.error({ err: error, key }, 'Cache Delete Error');
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();
    } catch (error) {
      logger.error({ err: error }, 'Cache Clear Error');
    }
  }
}

export const cacheService = new CacheService();
