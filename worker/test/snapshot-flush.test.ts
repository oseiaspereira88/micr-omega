import { describe, expect, it, vi } from "vitest";
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

  it("debounces snapshot state persistence", async () => {
    vi.useFakeTimers();
    try {
      const { room, mockState } = await createRoom();
      const roomAny = room as any;

      roomAny.markPlayersDirty();
      roomAny.markWorldDirty();
      roomAny.markProgressionDirty();

      expect(mockState.storageImpl.getPutCount("snapshot_state")).toBe(0);

      const delay = RoomDO.SNAPSHOT_STATE_PERSIST_DEBOUNCE_MS;

      await vi.advanceTimersByTimeAsync(Math.max(0, delay - 1));

      expect(mockState.storageImpl.getPutCount("snapshot_state")).toBe(0);

      await vi.advanceTimersByTimeAsync(1);
      await vi.runOnlyPendingTimersAsync();

      const initialCount = mockState.storageImpl.getPutCount("snapshot_state");
      expect(initialCount).toBe(1);

      roomAny.markPlayersDirty();
      roomAny.markWorldDirty();

      await vi.advanceTimersByTimeAsync(delay);
      await vi.runOnlyPendingTimersAsync();

      expect(mockState.storageImpl.getPutCount("snapshot_state")).toBe(initialCount);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes pending snapshot state immediately when flushing snapshots", async () => {
    vi.useFakeTimers();
    try {
      const { room, mockState } = await createRoom();
      const roomAny = room as any;

      roomAny.markPlayersDirty();
      roomAny.markWorldDirty();

      await vi.advanceTimersByTimeAsync(RoomDO.SNAPSHOT_STATE_PERSIST_DEBOUNCE_MS);
      await vi.runOnlyPendingTimersAsync();

      expect(mockState.storageImpl.data.has("snapshot_state")).toBe(true);

      roomAny.markPlayersDirty();

      await roomAny.flushSnapshots();

      expect(mockState.storageImpl.data.has("snapshot_state")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("forces a snapshot flush for critical transitions", async () => {
    const { room, mockState } = await createRoom();
    const roomAny = room as any;

    roomAny.markPlayersDirty();

    await roomAny.flushSnapshots({ force: true });

    expect(mockState.storageImpl.getPutCount("players")).toBe(1);
    expect(mockState.storageImpl.getPutCount("world")).toBe(1);
  });

  it("reuses cached game state snapshots when no changes occur", async () => {
    const { room } = await createRoom();
    const roomAny = room as any;

    const first = roomAny.serializeGameState();
    const second = roomAny.serializeGameState();

    expect(second).toBe(first);

    roomAny.markPlayersDirty();

    const third = roomAny.serializeGameState();
    expect(third).not.toBe(second);

    const fourth = roomAny.serializeGameState();
    expect(fourth).toBe(third);
  });
});
