import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface ScraperSessionData {
  id: string;
  keyword: string;
  location: string;
  limit: number;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: {
    totalExtracted: number;
    totalStored: number;
    totalDuplicates: number;
  };
  error?: string;
  retryCount: number;
}

export class ScraperSession {
  public readonly id: string;
  public readonly keyword: string;
  public readonly location: string;
  public readonly limit: number;
  public startTime: Date;
  public endTime?: Date;
  public status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
  public result?: {
    totalExtracted: number;
    totalStored: number;
    totalDuplicates: number;
  };
  public error?: string;
  public retryCount: number = 0;

  constructor(keyword: string, location: string, limit: number) {
    this.id = uuidv4();
    this.keyword = keyword;
    this.location = location;
    this.limit = limit;
    this.startTime = new Date();
  }

  /**
   * Mark session as running
   */
  start(): void {
    this.status = 'running';
    this.retryCount = 0;
    logger.info(`ScraperSession ${this.id}: Started for "${this.keyword}" in "${this.location}"`);
  }

  /**
   * Mark session as completed
   */
  complete(result: {
    totalExtracted: number;
    totalStored: number;
    totalDuplicates: number;
  }): void {
    this.status = 'completed';
    this.endTime = new Date();
    this.result = result;
    logger.info(`ScraperSession ${this.id}: Completed with ${result.totalStored} leads`);
  }

  /**
   * Mark session as failed
   */
  fail(error: string): void {
    this.status = 'failed';
    this.endTime = new Date();
    this.error = error;
    logger.error(`ScraperSession ${this.id}: Failed - ${error}`);
  }

  /**
   * Increment retry count
   */
  incrementRetry(): void {
    this.retryCount++;
  }

  /**
   * Get session duration in seconds
   */
  getDuration(): number {
    if (!this.endTime) {
      return 0;
    }
    return (this.endTime.getTime() - this.startTime.getTime()) / 1000;
  }

  /**
   * Get session info for monitoring
   */
  getInfo(): ScraperSessionData {
    return {
      id: this.id,
      keyword: this.keyword,
      location: this.location,
      limit: this.limit,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
      result: this.result,
      error: this.error,
      retryCount: this.retryCount,
    };
  }
}
