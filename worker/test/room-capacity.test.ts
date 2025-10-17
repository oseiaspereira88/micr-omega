import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { MAX_PLAYERS, RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";
import { createMockSocket, type MockSocketCloseRecord } from "./utils/mock-socket";

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
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

      for (let i = 0; i < MAX_PLAYERS; i++) {
        const socket = createMockSocket();
        const playerId = await roomAny.handleJoin(socket, { type: "join", name: `Player ${i}` });
        expect(typeof playerId === "string").toBe(true);
      }

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

      for (let i = 0; i < MAX_PLAYERS; i++) {
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

      const replacementSocket = createMockSocket();
      const replacementId = await roomAny.handleJoin(replacementSocket, {
        type: "join",
        name: "Replacement",
      });

      expect(typeof replacementId === "string").toBe(true);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
