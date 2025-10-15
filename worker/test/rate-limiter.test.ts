import { describe, expect, it } from "vitest";

import { MessageRateLimiter } from "../src/RoomDO";

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
    expect(limiter.getRetryAfterMs(700)).toBe(401);
    expect(limiter.getRetryAfterMs(1_101)).toBe(0);
  });
});
