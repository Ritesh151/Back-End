import { logger } from '../utils/logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>();
  private hitCount = 0;
  private missCount = 0;
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;

    setInterval(() => this.evictExpired(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missCount++;
      return null;
    }
    this.hitCount++;
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get stats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? `${((this.hitCount / total) * 100).toFixed(1)}%` : '0%';
    return { size: this.store.size, hits: this.hitCount, misses: this.missCount, hitRate };
  }

  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.debug({ evicted, remaining: this.store.size }, 'Cache: Evicted expired entries');
    }
  }
}

export const cacheService = new CacheService();
