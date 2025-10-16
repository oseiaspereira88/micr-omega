import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  await (room as any).ready;
  return { room, mockState };
}

describe("RoomDO serializeGameState usage", () => {
  it("serializes state once during handleJoin", async () => {
    const { room } = await createRoom();
    const roomAny = room as any;

    const originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = { OPEN: 1, CLOSING: 2, CLOSED: 3 };

    const socket = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    } as unknown as WebSocket;

    const serializeSpy = vi.spyOn(roomAny, "serializeGameState");

    try {
      await roomAny.handleJoin(socket, { type: "join", name: "Alice" });
      expect(serializeSpy).toHaveBeenCalledTimes(2);
    } finally {
      serializeSpy.mockRestore();
      if (originalWebSocket === undefined) {
        delete (globalThis as any).WebSocket;
      } else {
        (globalThis as any).WebSocket = originalWebSocket;
      }
    }
  });

  it("serializes state once when ending the game", async () => {
    const { room } = await createRoom();
    const roomAny = room as any;

    const serializeSpy = vi.spyOn(roomAny, "serializeGameState");

    try {
      await roomAny.endGame("completed");
      expect(serializeSpy).toHaveBeenCalledTimes(1);
    } finally {
      serializeSpy.mockRestore();
    }
  });
});
