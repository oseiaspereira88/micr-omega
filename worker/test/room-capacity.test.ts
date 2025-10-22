import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import {
  DEFAULT_RUNTIME_CONFIG,
  createRuntimeConfigBindings,
  type RuntimeConfig,
} from "../src/config/runtime";
import { MockDurableObjectState } from "./utils/mock-state";
import { createMockSocket, type MockSocketCloseRecord } from "./utils/mock-socket";

const DEFAULT_MAX_PLAYERS = DEFAULT_RUNTIME_CONFIG.maxPlayers;

async function createRoom(configOverrides?: Partial<RuntimeConfig>) {
  const mockState = new MockDurableObjectState();
  const envOverrides = configOverrides ? createRuntimeConfigBindings(configOverrides) : {};
  const room = new RoomDO(
    mockState as unknown as DurableObjectState,
    envOverrides as Env
  );
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny } as const;
}

describe("RoomDO capacity limits", () => {
  it("rejects new connections when the room is full", async () => {
    const originalWebSocket = (globalThis as any).WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 };
    (globalThis as any).WebSocket = websocketMock;

    try {
      const { roomAny } = await createRoom();

      for (let i = 0; i < DEFAULT_MAX_PLAYERS; i++) {
        const socket = createMockSocket();
        const playerId = await roomAny.handleJoin(socket, { type: "join", name: `Player ${i}` });
        expect(typeof playerId === "string").toBe(true);
      }

      expect(roomAny.getConnectedPlayersCount()).toBe(DEFAULT_MAX_PLAYERS);

      const sent: string[] = [];
      const closed: MockSocketCloseRecord[] = [];
      const overflowSocket = createMockSocket(sent, closed);
      const result = await roomAny.handleJoin(overflowSocket, {
        type: "join",
        name: "Overflow",
      });

      expect(result).toBeNull();
      expect(sent).toHaveLength(1);
      expect(JSON.parse(sent[0]!)).toEqual({ type: "error", reason: "room_full" });
      expect(closed).toContainEqual({ code: 1008, reason: "room_full" });
      expect(roomAny.getConnectedPlayersCount()).toBe(DEFAULT_MAX_PLAYERS);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("allows new players to join after a disconnect frees capacity", async () => {
    const originalWebSocket = (globalThis as any).WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 };
    (globalThis as any).WebSocket = websocketMock;

    try {
      const { roomAny } = await createRoom();
      const sockets: WebSocket[] = [];
      const playerIds: string[] = [];

      for (let i = 0; i < DEFAULT_MAX_PLAYERS; i++) {
        const socket = createMockSocket();
        const playerId = await roomAny.handleJoin(socket, { type: "join", name: `Player ${i}` });
        sockets.push(socket);
        playerIds.push(playerId);
      }

      const overflowSent: string[] = [];
      const overflowClosed: MockSocketCloseRecord[] = [];
      const overflowSocket = createMockSocket(overflowSent, overflowClosed);
      const overflowResult = await roomAny.handleJoin(overflowSocket, {
        type: "join",
        name: "Overflow",
      });
      expect(overflowResult).toBeNull();
      expect(overflowClosed).toContainEqual({ code: 1008, reason: "room_full" });

      await roomAny.handleDisconnect(sockets[0], playerIds[0]);

      expect(roomAny.getConnectedPlayersCount()).toBe(DEFAULT_MAX_PLAYERS - 1);

      const replacementSocket = createMockSocket();
      const replacementId = await roomAny.handleJoin(replacementSocket, {
        type: "join",
        name: "Replacement",
      });

      expect(typeof replacementId === "string").toBe(true);
      expect(roomAny.getConnectedPlayersCount()).toBe(DEFAULT_MAX_PLAYERS);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("does not retain players when the socket is already closed", async () => {
    const originalWebSocket = (globalThis as any).WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 };
    (globalThis as any).WebSocket = websocketMock;

    try {
      const { roomAny } = await createRoom();
      const socket = createMockSocket();
      (socket as any).readyState = websocketMock.CLOSED;

      const result = await roomAny.handleJoin(socket, { type: "join", name: "Ghost" });

      expect(result).toBeNull();
      expect(roomAny.getConnectedPlayersCount()).toBe(0);
      expect(roomAny.players.size).toBe(0);
      expect(roomAny.nameToPlayerId.size).toBe(0);
      expect(roomAny.progressionState.size).toBe(0);
      expect(roomAny.pendingProgression.size).toBe(0);
      expect(roomAny.progressionDirty).toBe(true);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("applies custom capacity from runtime config overrides", async () => {
    const originalWebSocket = (globalThis as any).WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 };
    (globalThis as any).WebSocket = websocketMock;

    const customMaxPlayers = 5;

    try {
      const { roomAny } = await createRoom({ maxPlayers: customMaxPlayers });

      for (let i = 0; i < customMaxPlayers; i++) {
        const socket = createMockSocket();
        const playerId = await roomAny.handleJoin(socket, { type: "join", name: `Player ${i}` });
        expect(typeof playerId === "string").toBe(true);
      }

      expect(roomAny.getConnectedPlayersCount()).toBe(customMaxPlayers);

      const overflowSent: string[] = [];
      const overflowClosed: MockSocketCloseRecord[] = [];
      const overflowSocket = createMockSocket(overflowSent, overflowClosed);
      const overflowResult = await roomAny.handleJoin(overflowSocket, {
        type: "join",
        name: "Overflow",
      });

      expect(overflowResult).toBeNull();
      expect(overflowClosed).toContainEqual({ code: 1008, reason: "room_full" });
      expect(roomAny.getConnectedPlayersCount()).toBe(customMaxPlayers);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
