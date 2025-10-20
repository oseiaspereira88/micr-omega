export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_MESSAGES_PER_CONNECTION = 4_200;
export const MAX_MESSAGES_GLOBAL = 12_000;
export const GLOBAL_RATE_LIMIT_HEADROOM = 1.25;
export const RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS = 5_000;
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

  getRetryAfterMs(now: number): number {
    this.prune(now);
    const earliest = this.timestamps[this.startIndex];
    if (earliest === undefined) {
      return 0;
    }
    return Math.max(0, earliest + this.windowMs - now);
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
