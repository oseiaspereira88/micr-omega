import { describe, expect, it } from "vitest";
import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { MockDurableObjectState } from "./utils/mock-state";

describe("RoomDO snapshot batching", () => {
  async function createRoom() {
    const mockState = new MockDurableObjectState();
    const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
    await (room as any).ready;
    mockState.storageImpl.resetCounts();
    return { room, mockState };
  }

  it("batches player and world snapshots within the flush window", async () => {
    const { room, mockState } = await createRoom();
    const roomAny = room as any;

    roomAny.markPlayersDirty();
    roomAny.markPlayersDirty();
    roomAny.markWorldDirty();

    expect(mockState.storageImpl.getPutCount("players")).toBe(0);
    expect(mockState.storageImpl.getPutCount("world")).toBe(0);

    await roomAny.flushSnapshots();

    expect(mockState.storageImpl.getPutCount("players")).toBe(1);
    expect(mockState.storageImpl.getPutCount("world")).toBe(1);
  });

  it("forces a snapshot flush for critical transitions", async () => {
    const { room, mockState } = await createRoom();
    const roomAny = room as any;

    roomAny.markPlayersDirty();

    await roomAny.flushSnapshots({ force: true });

    expect(mockState.storageImpl.getPutCount("players")).toBe(1);
    expect(mockState.storageImpl.getPutCount("world")).toBe(1);
  });
});
