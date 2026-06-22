import { logger } from '../utils/logger';
import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  websiteHash: string;
}

export class AuditCacheService {
  private static instance: AuditCacheService;
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.startCleanup();
  }

  static getInstance(): AuditCacheService {
    if (!AuditCacheService.instance) {
      AuditCacheService.instance = new AuditCacheService();
    }
    return AuditCacheService.instance;
  }

  hashWebsite(website: string): string {
    return crypto.createHash('sha256').update(website.toLowerCase().trim()).digest('hex').substring(0, 16);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, website?: string): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      websiteHash: website ? this.hashWebsite(website) : '',
    });
  }

  getByWebsiteHash<T>(key: string, website: string): { data: T | null; isCached: boolean } {
    const entry = this.cache.get(key);
    if (!entry) return { data: null, isCached: false };
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL_MS) {
      this.cache.delete(key);
      return { data: null, isCached: false };
    }
    const currentHash = this.hashWebsite(website);
    if (entry.websiteHash !== currentHash) {
      this.cache.delete(key);
      return { data: null, isCached: false };
    }
    return { data: entry.data as T, isCached: true };
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let removed = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.DEFAULT_TTL_MS) {
          this.cache.delete(key);
          removed++;
        }
      }
      if (removed > 0) {
        logger.debug({ removed }, 'AuditCache: Cleaned up expired entries');
      }
    }, 60000);
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const auditCache = AuditCacheService.getInstance();
