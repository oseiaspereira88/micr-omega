import { afterEach, describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

const RNG_STATE_KEY = "rng_state";

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  mockState.storageImpl.resetCounts();
  return { roomAny, mockState } as const;
}

describe("RoomDO RNG persistence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces RNG state persistence within the flush window", async () => {
    vi.useFakeTimers();
    const { roomAny, mockState } = await createRoom();

    roomAny.organicMatterRespawnRng();
    roomAny.organicMatterRespawnRng();
    roomAny.progressionRng();

    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(0);

    await vi.advanceTimersByTimeAsync(RoomDO.RNG_STATE_PERSIST_DEBOUNCE_MS - 1);
    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(1);
  });

  it("flushes pending RNG state persistence when forced", async () => {
    vi.useFakeTimers();
    const { roomAny, mockState } = await createRoom();

    roomAny.organicMatterRespawnRng();

    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(0);

    await roomAny.flushQueuedRngStatePersist({ force: true });

    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(1);
    await vi.advanceTimersByTimeAsync(RoomDO.RNG_STATE_PERSIST_DEBOUNCE_MS);
    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(1);
  });
});
