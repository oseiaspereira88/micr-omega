import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

const createMockSocket = () => {
  const openState = ((globalThis as any).WebSocket?.OPEN ?? 1) as number;
  return {
    readyState: openState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
};

describe("RoomDO reconnection status handling", () => {
  it("prunes expired status effects and normalizes cooldown state on reconnect", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    vi.useFakeTimers();

    try {
      const initialTime = 1_000_000;
      vi.setSystemTime(initialTime);

      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.scheduleWorldTick = vi.fn();
      roomAny.maybeStartGame = vi.fn().mockResolvedValue(undefined);
      roomAny.broadcast = vi.fn();
      roomAny.send = vi.fn();

      const joinSocket = createMockSocket();
      const playerId = await roomAny.handleJoin(joinSocket, { type: "join", name: "Alice" });
      expect(playerId).toBeTruthy();

      const player = roomAny.players.get(playerId!);
      expect(player).toBeDefined();
      if (!player) {
        throw new Error("player not created");
      }

      const [skillKey] = player.skillState.available as string[];
      expect(skillKey).toBeDefined();

      roomAny.clientsBySocket.delete(joinSocket);
      roomAny.socketsByPlayer.delete(player.id);
      roomAny.activeSockets.delete(joinSocket);

      player.connected = false;
      player.lastSeenAt = initialTime;
      player.statusEffects = [
        { status: "RESTORE", stacks: 1, expiresAt: initialTime + 2_000 }
      ];
      player.invulnerableUntil = initialTime + 1_000;
      player.skillState.cooldowns[skillKey] = 4_000;
      player.combatStatus = {
        state: "cooldown",
        targetPlayerId: null,
        targetObjectId: null,
        lastAttackAt: initialTime - 10_000,
      };

      const reconnectTime = initialTime + 10_000;
      vi.setSystemTime(reconnectTime);

      const reconnectSocket = createMockSocket();
      await roomAny.handleJoin(reconnectSocket, {
        type: "join",
        name: "Alice",
        playerId: player.id,
        reconnectToken: player.reconnectToken,
      });

      expect(player.statusEffects).toEqual([]);
      expect(player.invulnerableUntil).toBeNull();
      expect(player.skillState.cooldowns[skillKey]).toBe(0);
      expect(player.combatStatus.state).toBe("idle");
    } finally {
      vi.useRealTimers();
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("retains idle players that reconnect within the grace window", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    vi.useFakeTimers();

    let removeSpy: ReturnType<typeof vi.spyOn> | null = null;

    try {
      const initialTime = 500_000;
      vi.setSystemTime(initialTime);

      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.scheduleWorldTick = vi.fn();
      roomAny.maybeStartGame = vi.fn().mockResolvedValue(undefined);
      roomAny.broadcast = vi.fn();
      roomAny.send = vi.fn();
      removeSpy = vi.spyOn(roomAny, "removePlayer");

      const joinSocket = createMockSocket();
      const playerId = await roomAny.handleJoin(joinSocket, { type: "join", name: "Idle" });
      expect(playerId).toBeTruthy();

      const player = roomAny.players.get(playerId!);
      expect(player).toBeDefined();
      if (!player) {
        throw new Error("player not created");
      }

      const inactivityTimeoutMs = 45_000;
      player.lastActiveAt = initialTime - inactivityTimeoutMs - 1_000;

      await roomAny.handleDisconnect(joinSocket, player.id);

      const reconnectTime = initialTime + 1_000;
      vi.setSystemTime(reconnectTime);

      const reconnectSocket = createMockSocket();
      const result = await roomAny.handleJoin(reconnectSocket, {
        type: "join",
        name: player.name,
        playerId: player.id,
        reconnectToken: player.reconnectToken,
      });

      expect(result).toBe(player.id);
      expect(removeSpy).not.toHaveBeenCalled();
      expect(roomAny.players.get(player.id)).toBeDefined();
    } finally {
      removeSpy?.mockRestore();
      vi.useRealTimers();
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("restores previous reconnect token when snapshot flush fails", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    vi.useFakeTimers();

    try {
      const initialTime = 2_000_000;
      vi.setSystemTime(initialTime);

      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.scheduleWorldTick = vi.fn();
      roomAny.maybeStartGame = vi.fn().mockResolvedValue(undefined);
      roomAny.broadcast = vi.fn();
      roomAny.send = vi.fn();
      roomAny.queueSnapshotStatePersist = vi.fn();
      roomAny.queueSyncAlarms = vi.fn();

      const joinSocket = createMockSocket();
      const playerId = await roomAny.handleJoin(joinSocket, { type: "join", name: "Bob" });
      expect(playerId).toBeTruthy();

      const player = roomAny.players.get(playerId!);
      expect(player).toBeDefined();
      if (!player) {
        throw new Error("player not created");
      }

      const originalToken = player.reconnectToken;

      roomAny.clientsBySocket.delete(joinSocket);
      roomAny.socketsByPlayer.delete(player.id);
      roomAny.activeSockets.delete(joinSocket);

      player.connected = false;
      player.lastSeenAt = initialTime;

      const reconnectTime = initialTime + 5_000;
      vi.setSystemTime(reconnectTime);

      const flushSnapshotsMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("flush failed"))
        .mockResolvedValue(undefined);
      roomAny.flushSnapshots = flushSnapshotsMock;

      roomAny.send.mockClear();
      const failingSocket = createMockSocket();
      const failedResult = await roomAny.handleJoin(failingSocket, {
        type: "join",
        name: "Bob",
        playerId: player.id,
        reconnectToken: originalToken,
      });

      expect(failedResult).toBeNull();
      expect(roomAny.send).toHaveBeenCalledWith(failingSocket, {
        type: "error",
        reason: "internal_error",
      });
      expect(failingSocket.close).toHaveBeenCalledWith(1011, "internal_error");
      expect(player.reconnectToken).toBe(originalToken);

      roomAny.send.mockClear();
      const retrySocket = createMockSocket();
      const retryResult = await roomAny.handleJoin(retrySocket, {
        type: "join",
        name: "Bob",
        playerId: player.id,
        reconnectToken: originalToken,
      });

      expect(retryResult).toBe(player.id);
      expect(flushSnapshotsMock).toHaveBeenCalledTimes(2);
      expect(player.reconnectToken).not.toBe(originalToken);

      const joinedCall = roomAny.send.mock.calls.find(
        ([socket, message]: any[]) => socket === retrySocket && message?.type === "joined"
      );
      expect(joinedCall).toBeTruthy();
      if (joinedCall) {
        const [, joinedMessage] = joinedCall as [any, any];
        expect(joinedMessage.reconnectToken).toBe(player.reconnectToken);
      }
    } finally {
      vi.useRealTimers();
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
