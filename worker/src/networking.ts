import { DEFAULT_RUNTIME_CONFIG } from "./config/runtime";

export const RATE_LIMIT_WINDOW_MS = DEFAULT_RUNTIME_CONFIG.rateLimitWindowMs;
export const MAX_MESSAGES_PER_CONNECTION = DEFAULT_RUNTIME_CONFIG.maxMessagesPerConnection;
export const MAX_MESSAGES_GLOBAL = DEFAULT_RUNTIME_CONFIG.maxMessagesGlobal;
export const GLOBAL_RATE_LIMIT_HEADROOM = DEFAULT_RUNTIME_CONFIG.globalRateLimitHeadroom;
export const RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS =
  DEFAULT_RUNTIME_CONFIG.rateLimitUtilizationReportIntervalMs;
export const MAX_CLIENT_MESSAGE_SIZE_BYTES = 16 * 1024;

export class MessageRateLimiter {
  private timestamps: number[] = [];
  private startIndex = 0;

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  consume(now: number, limitOverride?: number): boolean {
    this.prune(now);
    const limit = limitOverride ?? this.limit;
    if (this.getActiveCount() >= limit) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  getUtilization(now: number, limitOverride?: number): number {
    this.prune(now);
    const limit = limitOverride ?? this.limit;
    if (limit <= 0) {
      return 0;
    }
    return this.getActiveCount() / limit;
  }

  getRetryAfterMs(now: number, limitOverride?: number): number {
    this.prune(now);
    const limit = limitOverride ?? this.limit;

    if (limit <= 0) {
      return 0;
    }

    const activeCount = this.getActiveCount();
    if (activeCount < limit) {
      return 0;
    }

    const index = this.startIndex + (activeCount - limit);
    const releaseTimestamp = this.timestamps[index];
    if (releaseTimestamp === undefined) {
      return 0;
    }

    return Math.max(0, releaseTimestamp + this.windowMs - now);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.startIndex < this.timestamps.length && this.timestamps[this.startIndex]! <= cutoff) {
      this.startIndex++;
    }

    if (this.startIndex > 0 && this.startIndex * 2 >= this.timestamps.length) {
      this.timestamps = this.timestamps.slice(this.startIndex);
      this.startIndex = 0;
    }
  }

  private getActiveCount(): number {
    return this.timestamps.length - this.startIndex;
  }
}
