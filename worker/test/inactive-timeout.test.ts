import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

describe("RoomDO inactivity handling", () => {
  it("closes inactive player sockets during world ticks", async () => {
    const originalWebSocket = (globalThis as any).WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 };
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      const now = Date.now();
      const inactivityTimeoutMs = 45_000;
      const tickTime = now + inactivityTimeoutMs + 1_000;

      const player = {
        id: "player-1",
        name: "Alice",
        score: 0,
        combo: 1,
        energy: 100,
        xp: 0,
        geneticMaterial: 0,
        position: { x: 0, y: 0 },
        movementVector: { x: 0, y: 0 },
        orientation: { angle: 0 },
        health: { current: 100, max: 100 },
        combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null, lastAttackAt: now },
        combatAttributes: { attack: 1, defense: 1, speed: 1, range: 1 },
        connected: true,
        lastActiveAt: now,
        lastSeenAt: now,
        connectedAt: now,
        totalSessionDurationMs: 0,
        sessionCount: 0,
      };

      const broadcastSpy = vi.fn();
      roomAny.broadcast = broadcastSpy;

      const closeCalls: { code: number | undefined; reason: string | undefined }[] = [];
      const disconnectPromises: Promise<void>[] = [];

      const socket = {
        readyState: websocketMock.OPEN,
        send: vi.fn(),
        close: (code?: number, reason?: string) => {
          closeCalls.push({ code, reason });
          (socket as any).readyState = websocketMock.CLOSED;
          const promise = roomAny.handleDisconnect(socket, player.id);
          disconnectPromises.push(promise);
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      roomAny.players.set(player.id, player);
      roomAny.nameToPlayerId.set(player.name.toLowerCase(), player.id);
      roomAny.socketsByPlayer.set(player.id, socket);
      roomAny.clientsBySocket.set(socket, player.id);

      player.lastSeenAt = tickTime - inactivityTimeoutMs - 100;
      player.lastActiveAt = player.lastSeenAt;

      roomAny.alarmSchedule.set("world_tick", tickTime);

      await roomAny.handleWorldTickAlarm(tickTime);
      await Promise.all(disconnectPromises);

      expect(closeCalls).toEqual([
        {
          code: 1001,
          reason: "inactive_timeout",
        },
      ]);

      expect(player.connected).toBe(false);

      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "state",
          mode: "diff",
          state: expect.objectContaining({
            upsertPlayers: [
              expect.objectContaining({
                id: player.id,
                connected: false,
              }),
            ],
          }),
        }),
        socket,
      );

      expect(roomAny.socketsByPlayer.has(player.id)).toBe(false);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
