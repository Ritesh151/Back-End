import { logger } from '../utils/logger';

interface ProfilerEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export class PerformanceProfiler {
  private entries: ProfilerEntry[] = [];
  private current: ProfilerEntry | null = null;

  start(name: string, metadata?: Record<string, unknown>): void {
    this.current = { name, startTime: Date.now(), metadata };
  }

  end(): number {
    if (!this.current) return 0;
    this.current.endTime = Date.now();
    this.current.duration = this.current.endTime - this.current.startTime;
    this.entries.push(this.current);
    const duration = this.current.duration;
    logger.debug(
      { name: this.current.name, duration, ...this.current.metadata },
      `[Profiler] ${this.current.name} took ${duration}ms`
    );
    this.current = null;
    return duration;
  }

  getEntries(): ProfilerEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.current = null;
  }

  getLast(): ProfilerEntry | null {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
  }

  summary(): Record<string, { count: number; total: number; avg: number; max: number }> {
    const grouped: Record<string, number[]> = {};
    for (const entry of this.entries) {
      if (!entry.duration) continue;
      if (!grouped[entry.name]) grouped[entry.name] = [];
      grouped[entry.name].push(entry.duration);
    }
    const result: Record<string, { count: number; total: number; avg: number; max: number }> = {};
    for (const [name, durations] of Object.entries(grouped)) {
      const total = durations.reduce((a, b) => a + b, 0);
      result[name] = {
        count: durations.length,
        total,
        avg: Math.round(total / durations.length),
        max: Math.max(...durations),
      };
    }
    return result;
  }
}

export const profiler = new PerformanceProfiler();
