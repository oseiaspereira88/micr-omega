import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
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
      const player = {
        id: "player-1",
        name: "Alice",
        score: 0,
        combo: 1,
        energy: 100,
        xp: 0,
        geneticMaterial: 0,
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
      };

      roomAny.players.set(player.id, player);
      roomAny.nameToPlayerId.set(player.name.toLowerCase(), player.id);

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

      expect(broadcastSpy).toHaveBeenCalledWith(
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
      };

      roomAny.players.set(disconnected.id, disconnected);
      roomAny.players.set(victim.id, victim);
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

  it("prevents pending attacks from reprocessing after reconnect", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      const attackerSocket = createMockSocket();
      const attackerId = await roomAny.handleJoin(attackerSocket, { type: "join", name: "Attacker" });
      const targetSocket = createMockSocket();
      const targetId = await roomAny.handleJoin(targetSocket, { type: "join", name: "Target" });

      const attacker = roomAny.players.get(attackerId)!;
      const target = roomAny.players.get(targetId)!;

      attacker.position = { x: 0, y: 0 };
      target.position = { x: 0, y: 0 };
      attacker.combatAttributes.range = 100;
      attacker.combatAttributes.attack = 25;
      target.combatAttributes.defense = 0;

      const attackTime = Date.now();
      await roomAny.handleActionMessage(
        {
          type: "action",
          playerId: attackerId,
          clientTime: attackTime,
          action: {
            type: "attack",
            kind: "basic",
            targetPlayerId: targetId,
          },
        },
        attackerSocket,
      );

      expect(attacker.pendingAttack).not.toBeNull();

      const initialTargetHealth = target.health.current;

      roomAny.playersPendingRemoval.add(attackerId);
      attacker.pendingRemoval = true;

      await roomAny.handleDisconnect(attackerSocket, attackerId);

      const reconnectToken = attacker.reconnectToken;
      const reconnectSocket = createMockSocket();
      const reconnectResult = await roomAny.handleJoin(reconnectSocket, {
        type: "join",
        name: "Attacker",
        playerId: attackerId,
        reconnectToken,
      });

      expect(reconnectResult).toBe(attackerId);
      expect(attacker.pendingAttack).toBeNull();
      expect(attacker.pendingRemoval).toBe(false);
      expect(roomAny.playersPendingRemoval.has(attackerId)).toBe(false);

      roomAny.phase = "active";
      const tickTime = attackTime + 2_000;
      roomAny.alarmSchedule.set("world_tick", tickTime);
      roomAny.lastWorldTickAt = attackTime;
      roomAny.broadcast = vi.fn();

      await roomAny.handleWorldTickAlarm(tickTime);

      expect(target.health.current).toBe(initialTargetHealth);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
