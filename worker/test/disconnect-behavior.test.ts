import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO, hashReconnectToken } from "../src/RoomDO";
import type { Env } from "../src";
import type { CombatLogEntry, SharedWorldStateDiff } from "../src/types";
import { MockDurableObjectState } from "./utils/mock-state";
import { createMockSocket } from "./utils/mock-socket";

describe("RoomDO disconnect behavior", () => {
  it("clears movement and combat state and broadcasts immediately on disconnect", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      const now = Date.now();
      const playerReconnectToken = "player-reconnect-token";
      const playerReconnectTokenHash = await hashReconnectToken(playerReconnectToken);
      const player = {
        id: "player-1",
        name: "Alice",
        score: 0,
        combo: 1,
        energy: 100,
        xp: 0,
        geneticMaterial: 0,
        dashCharge: 100,
        dashCooldownMs: 0,
        position: { x: 0, y: 0 },
        movementVector: { x: 1, y: 0 },
        orientation: { angle: 0 },
        health: { current: 100, max: 100 },
        combatStatus: {
          state: "engaged",
          targetPlayerId: "player-2",
          targetObjectId: null,
          lastAttackAt: now - 1_000,
        },
        combatAttributes: { attack: 1, defense: 1, speed: 1, range: 1 },
        connected: true,
        lastActiveAt: now,
        lastSeenAt: now,
        connectedAt: now,
        totalSessionDurationMs: 0,
        sessionCount: 0,
        reconnectToken: playerReconnectToken,
        reconnectTokenHash: playerReconnectTokenHash,
      };

      const survivorReconnectToken = "survivor-reconnect-token";
      const survivorReconnectTokenHash = await hashReconnectToken(survivorReconnectToken);
      const survivor = {
        id: "player-2",
        name: "Bob",
        score: 42,
        combo: 1,
        energy: 100,
        xp: 0,
        geneticMaterial: 0,
        dashCharge: 100,
        dashCooldownMs: 0,
        position: { x: 10, y: 10 },
        movementVector: { x: 0, y: 0 },
        orientation: { angle: 0 },
        health: { current: 100, max: 100 },
        combatStatus: {
          state: "idle",
          targetPlayerId: null,
          targetObjectId: null,
          lastAttackAt: null,
        },
        combatAttributes: { attack: 1, defense: 1, speed: 1, range: 1 },
        connected: true,
        lastActiveAt: now,
        lastSeenAt: now,
        connectedAt: now,
        totalSessionDurationMs: 0,
        sessionCount: 0,
        reconnectToken: survivorReconnectToken,
        reconnectTokenHash: survivorReconnectTokenHash,
      };

      roomAny.players.set(player.id, player);
      roomAny.players.set(survivor.id, survivor);
      roomAny.nameToPlayerId.set(player.name.toLowerCase(), player.id);
      roomAny.nameToPlayerId.set(survivor.name.toLowerCase(), survivor.id);
      roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

      const socket = {
        readyState: websocketMock.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      roomAny.socketsByPlayer.set(player.id, socket);
      roomAny.clientsBySocket.set(socket, player.id);
      roomAny.activeSockets.add(socket);

      const broadcastSpy = vi.fn();
      roomAny.broadcast = broadcastSpy;

      await roomAny.handleDisconnect(socket, player.id);

      expect(player.movementVector).toEqual({ x: 0, y: 0 });
      expect(player.combatStatus).toEqual({
        state: "idle",
        targetPlayerId: null,
        targetObjectId: null,
        lastAttackAt: null,
      });

      expect(roomAny.getConnectedPlayersCount()).toBe(1);

      expect(broadcastSpy).toHaveBeenNthCalledWith(
        1,
        {
          type: "ranking",
          ranking: [
            {
              playerId: survivor.id,
              name: survivor.name,
              score: survivor.score,
            },
          ],
        },
        socket,
      );

      expect(broadcastSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: "state",
          mode: "diff",
          state: expect.objectContaining({
            upsertPlayers: [
              expect.objectContaining({
                id: player.id,
                connected: false,
                movementVector: { x: 0, y: 0 },
                combatStatus: {
                  state: "idle",
                  targetPlayerId: null,
                  targetObjectId: null,
                  lastAttackAt: null,
                },
              }),
            ],
          }),
        }),
        socket,
      );
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("skips disconnected players during world tick processing", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      const tickTime = Date.now();
      const victim = {
        id: "player-2",
        name: "Bob",
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
        combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null, lastAttackAt: null },
        combatAttributes: { attack: 1, defense: 1, speed: 1, range: 1 },
        connected: true,
        lastActiveAt: tickTime,
        lastSeenAt: tickTime,
        connectedAt: tickTime,
        totalSessionDurationMs: 0,
        sessionCount: 0,
      };

      const disconnected = {
        id: "player-1",
        name: "Alice",
        score: 0,
        combo: 1,
        position: { x: 5, y: 5 },
        movementVector: { x: 1, y: 0 },
        orientation: { angle: 0 },
        health: { current: 100, max: 100 },
        combatStatus: {
          state: "engaged",
          targetPlayerId: victim.id,
          targetObjectId: null,
          lastAttackAt: null,
        },
        combatAttributes: { attack: 10, defense: 1, speed: 10, range: 10 },
        connected: false,
        lastActiveAt: tickTime,
        lastSeenAt: tickTime,
        connectedAt: null,
        totalSessionDurationMs: 0,
        sessionCount: 0,
        dashCharge: 100,
        dashCooldownMs: 0,
      };

      roomAny.players.set(disconnected.id, disconnected);
      roomAny.players.set(victim.id, victim);
      roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();
      roomAny.nameToPlayerId.set(disconnected.name.toLowerCase(), disconnected.id);
      roomAny.nameToPlayerId.set(victim.name.toLowerCase(), victim.id);

      roomAny.alarmSchedule.set("world_tick", tickTime);
      roomAny.lastWorldTickAt = tickTime - 100;

      const moveSpy = vi.spyOn(roomAny, "movePlayerDuringTick");
      const collectionSpy = vi.spyOn(roomAny, "handleCollectionsDuringTick");
      const attackSpy = vi.spyOn(roomAny, "resolvePlayerAttackDuringTick");
      roomAny.broadcast = vi.fn();

      await roomAny.handleWorldTickAlarm(tickTime);

      expect(disconnected.position).toEqual({ x: 5, y: 5 });
      expect(victim.health.current).toBe(100);

      expect(moveSpy.mock.calls.some(([player]) => player === disconnected)).toBe(false);
      expect(collectionSpy.mock.calls.some(([player]) => player === disconnected)).toBe(false);
      expect(attackSpy.mock.calls.some(([player]) => player === disconnected)).toBe(false);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("restores pending players that reconnect immediately after death", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      const firstSocket = {
        readyState: websocketMock.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      const playerId = await roomAny.handleJoin(firstSocket, { type: "join", name: "Alice" });
      expect(typeof playerId).toBe("string");

      const player = roomAny.players.get(playerId)!;
      const reconnectToken = player.reconnectToken;

      const now = Date.now();
      roomAny.queuePlayerDeath(player, now, new Map());

      expect(player.pendingRemoval).toBe(true);
      expect(roomAny.playersPendingRemoval.has(playerId)).toBe(true);
      expect(roomAny.pendingPlayerDeaths.some((entry: any) => entry.playerId === playerId)).toBe(true);

      const secondSocket = {
        readyState: websocketMock.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      const rejoinedId = await roomAny.handleJoin(secondSocket, {
        type: "join",
        name: "Alice",
        playerId,
        reconnectToken,
      });

      expect(rejoinedId).toBe(playerId);
      expect(player.pendingRemoval).toBe(false);
      expect(roomAny.playersPendingRemoval.has(playerId)).toBe(false);
      expect(roomAny.pendingPlayerDeaths.some((entry: any) => entry.playerId === playerId)).toBe(false);
      expect(roomAny.socketsByPlayer.get(playerId)).toBe(secondSocket);

      const candidates = roomAny.getMicroorganismTargetCandidates();
      expect(candidates.some((candidate: any) => candidate.id === playerId)).toBe(true);

      expect(firstSocket.close).toHaveBeenCalledWith(1000, "reconnected");
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("clears pending attacks when reconnecting mid-attack", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    vi.useFakeTimers();

    try {
      const initialTime = 5_000_000;
      vi.setSystemTime(initialTime);

      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.broadcast = vi.fn();
      roomAny.send = vi.fn();

      const attackerSocket = createMockSocket();
      const attackerId = await roomAny.handleJoin(attackerSocket, { type: "join", name: "Attacker" });
      expect(typeof attackerId).toBe("string");

      const targetSocket = createMockSocket();
      const targetId = await roomAny.handleJoin(targetSocket, { type: "join", name: "Target" });
      expect(typeof targetId).toBe("string");

      const attacker = roomAny.players.get(attackerId!);
      const target = roomAny.players.get(targetId!);
      expect(attacker).toBeDefined();
      expect(target).toBeDefined();
      if (!attacker || !target) {
        throw new Error("players not created");
      }

      const actionResult = roomAny.applyPlayerAction(attacker, {
        type: "attack",
        kind: "basic",
        targetPlayerId: target.id,
        state: "engaged",
      });
      expect(actionResult).not.toBeNull();
      expect(attacker.pendingAttack).not.toBeNull();
      expect(attacker.combatStatus.state).toBe("engaged");

      await roomAny.handleDisconnect(attackerSocket, attacker.id);
      expect(attacker.connected).toBe(false);
      expect(attacker.pendingAttack).not.toBeNull();

      roomAny.playersPendingRemoval.add(attacker.id);

      const reconnectTime = initialTime + 3_000;
      vi.setSystemTime(reconnectTime);

      const reconnectSocket = createMockSocket();
      const reconnectResult = await roomAny.handleJoin(reconnectSocket, {
        type: "join",
        name: "Attacker",
        playerId: attacker.id,
        reconnectToken: attacker.reconnectToken,
      });

      expect(reconnectResult).toBe(attacker.id);
      expect(attacker.pendingAttack).toBeNull();
      expect(roomAny.playersPendingRemoval.has(attacker.id)).toBe(false);

      const worldDiff: SharedWorldStateDiff = {};
      const combatLog: CombatLogEntry[] = [];
      const updatedPlayers = new Map<string, typeof attacker>();
      const resolution = roomAny.resolvePlayerAttackDuringTick(
        attacker,
        reconnectTime + 1_000,
        worldDiff,
        combatLog,
        updatedPlayers,
      );

      expect(resolution.worldChanged).toBe(false);
      expect(combatLog).toHaveLength(0);
      expect(target.health.current).toBe(target.health.max);
    } finally {
      vi.useRealTimers();
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
