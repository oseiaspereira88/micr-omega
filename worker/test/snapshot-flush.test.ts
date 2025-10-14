import { describe, expect, it } from "vitest";
import type { DurableObjectState, DurableObjectStorage } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";

class MockStorage {
  readonly data = new Map<string, unknown>();
  readonly putCounts = new Map<string, number>();
  private alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.putCounts.set(key, (this.putCounts.get(key) ?? 0) + 1);
    this.data.set(key, typeof structuredClone === "function" ? structuredClone(value) : value);
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.data.delete(key);
    return existed;
  }

  async setAlarm(timestamp: number): Promise<void> {
    this.alarm = timestamp;
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  resetCounts(): void {
    this.putCounts.clear();
  }

  getPutCount(key: string): number {
    return this.putCounts.get(key) ?? 0;
  }
}

class MockDurableObjectState {
  readonly storageImpl = new MockStorage();
  readonly storage: DurableObjectStorage;

  constructor() {
    this.storage = {
      get: (key: string) => this.storageImpl.get(key),
      put: (key: string, value: unknown) => this.storageImpl.put(key, value),
      delete: (key: string) => this.storageImpl.delete(key),
      setAlarm: (timestamp: number) => this.storageImpl.setAlarm(timestamp),
      getAlarm: () => this.storageImpl.getAlarm(),
    } as unknown as DurableObjectStorage;
  }

  waitUntil(): void {
    // no-op for tests
  }
}

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
