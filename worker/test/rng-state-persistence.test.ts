import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

const RNG_STATE_KEY = "rng_state";

type TestRngState = {
  organicMatterRespawn: number;
  progression: number;
};

async function createRoom(options: { state?: MockDurableObjectState; rngState?: TestRngState } = {}) {
  const mockState = options.state ?? new MockDurableObjectState();
  if (options.rngState) {
    const snapshot =
      typeof structuredClone === "function" ? structuredClone(options.rngState) : { ...options.rngState };
    mockState.storageImpl.data.set(RNG_STATE_KEY, snapshot);
  }

  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny, mockState } as const;
}

describe("RoomDO RNG state persistence", () => {
  it("skips persisting RNG state on startup when stored state exists", async () => {
    const seeds: TestRngState = {
      organicMatterRespawn: 0x517cc1b7,
      progression: 0x9e3779b9,
    };

    const { mockState } = await createRoom({ rngState: seeds });

    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(0);
  });

  it("persists initial RNG state when no stored state exists", async () => {
    const { mockState } = await createRoom();

    expect(mockState.storageImpl.getPutCount(RNG_STATE_KEY)).toBe(1);
    const stored = mockState.storageImpl.data.get(RNG_STATE_KEY) as TestRngState | undefined;
    expect(stored).toBeDefined();
    expect(stored?.organicMatterRespawn).toBeGreaterThan(0);
    expect(stored?.progression).toBeGreaterThan(0);
  });
});
