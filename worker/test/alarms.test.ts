import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState, WebSocket } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { setRuntimeConfigOverrides, type RuntimeConfigOverrides } from "../src/config/runtime";
import { MockDurableObjectState } from "./utils/mock-state";

async function createRoom(runtimeOverrides?: RuntimeConfigOverrides) {
  const mockState = new MockDurableObjectState();
  setRuntimeConfigOverrides(runtimeOverrides);
  const envOverrides = runtimeOverrides
    ? (Object.fromEntries(
        Object.entries(runtimeOverrides).map(([key, value]) => [key, String(value)])
      ) as Partial<Env>)
    : {};
  const room = new RoomDO(
    mockState as unknown as DurableObjectState,
    envOverrides as Env,
  );
  await (room as any).ready;
  mockState.storageImpl.resetCounts();
  return { room, mockState };
}

describe("RoomDO alarms", () => {
  it("does not persist alarms for steady world ticks", async () => {
    const { room, mockState } = await createRoom();
    const roomAny = room as any;

    for (let i = 0; i < 3; i += 1) {
      roomAny.alarmSchedule.set("world_tick", Date.now() - 1);
      await room.alarm();
    }

    expect(mockState.storageImpl.getPutCount("alarms")).toBe(0);
  });

  it("persists lifecycle alarm changes", async () => {
    const { room, mockState } = await createRoom();
    const roomAny = room as any;

    const stalePlayer = {
      id: "p1",
      name: "Player One",
      score: 0,
      combo: 1,
      energy: 100,
      xp: 0,
      geneticMaterial: 0,
      dashCharge: 100,
      dashCooldownMs: 0,
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 100, max: 100 },
      combatStatus: { state: "idle" },
      combatAttributes: { attack: 0, defense: 0, speed: 0, range: 0 },
      connected: false,
      lastActiveAt: Date.now() - 60_000,
      lastSeenAt: Date.now() - 60_000,
      connectedAt: null,
    };
    roomAny.players.set(stalePlayer.id, stalePlayer);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    mockState.storageImpl.resetCounts();

    await roomAny.scheduleCleanupAlarm();

    expect(mockState.storageImpl.getPutCount("alarms")).toBe(1);
    const stored = mockState.storageImpl.data.get("alarms") as Record<string, number | null>;
    expect(stored).toMatchObject({ cleanup: expect.any(Number) });
  });

  it("does not persist cleanup alarm when unchanged", async () => {
    const { room, mockState } = await createRoom();
    const roomAny = room as any;

    const reconnectingPlayer = {
      id: "p1",
      name: "Player One",
      score: 0,
      combo: 1,
      energy: 100,
      xp: 0,
      geneticMaterial: 0,
      dashCharge: 100,
      dashCooldownMs: 0,
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 100, max: 100 },
      combatStatus: { state: "idle" },
      combatAttributes: { attack: 0, defense: 0, speed: 0, range: 0 },
      connected: false,
      lastActiveAt: Date.now() - 10_000,
      lastSeenAt: Date.now() - 10_000,
      connectedAt: null,
    };
    roomAny.players.set(reconnectingPlayer.id, reconnectingPlayer);

    await roomAny.scheduleCleanupAlarm();

    mockState.storageImpl.resetCounts();

    await roomAny.scheduleCleanupAlarm();

    expect(mockState.storageImpl.getPutCount("alarms")).toBe(0);
  });

  it("keeps alarms marked dirty when syncing alarms fails", async () => {
    const { room } = await createRoom();
    const roomAny = room as any;

    const syncError = new Error("sync failed");
    const syncAlarmsSpy = vi.spyOn(roomAny, "syncAlarms").mockRejectedValue(syncError);
    const logErrorSpy = vi
      .spyOn(roomAny.observability, "logError")
      .mockImplementation(() => undefined);

    roomAny.alarmsDirty = false;
    roomAny.persistentAlarmsDirty = false;

    roomAny.commitWorldTickScheduleChange();

    expect(syncAlarmsSpy).toHaveBeenCalledTimes(1);

    await Promise.resolve();

    expect(roomAny.alarmsDirty).toBe(true);
    expect(roomAny.persistentAlarmsDirty).toBe(false);

    syncAlarmsSpy.mockRestore();
    logErrorSpy.mockRestore();
  });

  it("pauses world ticks when everyone disconnects until a new player joins", async () => {
    const { room } = await createRoom();
    const roomAny = room as any;

    const originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = { OPEN: 1 };

    try {
      const firstSocket = {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as WebSocket;

      const firstPlayerId = await roomAny.handleJoin(firstSocket, {
        type: "join",
        name: "Alice",
      });

      expect(firstPlayerId).toBeTypeOf("string");
      expect(roomAny.alarmSchedule.has("world_tick")).toBe(true);

      roomAny.alarmSchedule.set("world_tick", Date.now() - 1);
      await room.alarm();
      expect(roomAny.alarmSchedule.has("world_tick")).toBe(true);

      await roomAny.handleDisconnect(firstSocket, firstPlayerId);

      roomAny.alarmSchedule.set("world_tick", Date.now() - 1);
      await room.alarm();
      expect(roomAny.alarmSchedule.has("world_tick")).toBe(false);

      await room.alarm();
      expect(roomAny.alarmSchedule.has("world_tick")).toBe(false);

      const secondSocket = {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as WebSocket;

      const secondPlayerId = await roomAny.handleJoin(secondSocket, {
        type: "join",
        name: "Bob",
      });

      expect(secondPlayerId).toBeTypeOf("string");
      expect(roomAny.alarmSchedule.has("world_tick")).toBe(true);
    } finally {
      if (originalWebSocket === undefined) {
        delete (globalThis as any).WebSocket;
      } else {
        (globalThis as any).WebSocket = originalWebSocket;
      }
    }
  });
});
