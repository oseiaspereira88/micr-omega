import { describe, expect, it } from "vitest";

import {
  MAX_MESSAGES_PER_CONNECTION,
  MessageRateLimiter,
  RATE_LIMIT_WINDOW_MS
} from "../src/RoomDO";

describe("MessageRateLimiter", () => {
  it("enforces limits within a rolling window and allows consumption once entries expire", () => {
    const limiter = new MessageRateLimiter(3, 1_000);

    expect(limiter.consume(0)).toBe(true);
    expect(limiter.consume(200)).toBe(true);
    expect(limiter.consume(400)).toBe(true);

    expect(limiter.consume(999)).toBe(false);
    expect(limiter.getRetryAfterMs(999)).toBe(1);

    expect(limiter.consume(1_000)).toBe(true);
    expect(limiter.consume(1_000)).toBe(false);
  });

  it("calculates retry-after durations based on the earliest unexpired entry", () => {
    const limiter = new MessageRateLimiter(2, 500);

    expect(limiter.getRetryAfterMs(0)).toBe(0);

    expect(limiter.consume(100)).toBe(true);
    expect(limiter.consume(200)).toBe(true);
    expect(limiter.consume(300)).toBe(false);
    expect(limiter.getRetryAfterMs(300)).toBe(300);

    expect(limiter.consume(601)).toBe(true);
    expect(limiter.getRetryAfterMs(600)).toBe(100);
    expect(limiter.getRetryAfterMs(700)).toBe(0);
    expect(limiter.getRetryAfterMs(1_101)).toBe(0);
  });

  it("uses the provided limit override when computing retry-after durations", () => {
    const limiter = new MessageRateLimiter(5, 1_000);

    for (let i = 0; i < 5; i += 1) {
      expect(limiter.consume(i * 100)).toBe(true);
    }

    expect(limiter.consume(500, 2)).toBe(false);
    expect(limiter.getRetryAfterMs(500, 2)).toBe(800);
    expect(limiter.getRetryAfterMs(500)).toBe(500);

    expect(limiter.getRetryAfterMs(1_301, 2)).toBe(0);
  });

  it("allows sustained bursts of at least 70 messages per second", () => {
    const limiter = new MessageRateLimiter(
      MAX_MESSAGES_PER_CONNECTION,
      RATE_LIMIT_WINDOW_MS
    );

    const allowedMessagesPerSecond = (MAX_MESSAGES_PER_CONNECTION * 1_000) / RATE_LIMIT_WINDOW_MS;
    expect(allowedMessagesPerSecond).toBeGreaterThanOrEqual(70);

    for (let i = 0; i < MAX_MESSAGES_PER_CONNECTION; i += 1) {
      expect(limiter.consume(i * (RATE_LIMIT_WINDOW_MS / MAX_MESSAGES_PER_CONNECTION))).toBe(true);
    }

    expect(limiter.consume(RATE_LIMIT_WINDOW_MS - 1)).toBe(false);
  });

  it("reports utilization ratios within the rolling window", () => {
    const limiter = new MessageRateLimiter(10, 1_000);

    for (let i = 0; i < 5; i += 1) {
      expect(limiter.consume(i * 100)).toBe(true);
    }

    expect(limiter.getUtilization(500)).toBeCloseTo(0.5);

    expect(limiter.consume(1_000)).toBe(true);
    expect(limiter.getUtilization(1_050)).toBeCloseTo(0.5);
    expect(limiter.getUtilization(1_050, 5)).toBeCloseTo(1);

    expect(limiter.getUtilization(2_001)).toBe(0);
  });

  it("supports dynamically increasing the active limit when requested", () => {
    const limiter = new MessageRateLimiter(2, 1_000);

    expect(limiter.consume(0)).toBe(true);
    expect(limiter.consume(10)).toBe(true);
    expect(limiter.consume(20)).toBe(false);

    expect(limiter.consume(20, 4)).toBe(true);
    expect(limiter.consume(30, 4)).toBe(true);
    expect(limiter.consume(40, 4)).toBe(false);
  });
});
