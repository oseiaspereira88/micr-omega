import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";
import { createMockSocket } from "./utils/mock-socket";

describe("RoomDO characteristic points serialization", () => {
  it("includes characteristic point state in joined payload", async () => {
    const originalWebSocket = (globalThis as any).WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 };
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      const sent: string[] = [];
      const socket = createMockSocket(sent);

      await roomAny.handleJoin(socket, { type: "join", name: "Explorer" });

      expect(sent.length).toBeGreaterThan(0);
      const joinedPayload = JSON.parse(sent[0]!);
      expect(joinedPayload.type).toBe("joined");
      expect(Array.isArray(joinedPayload.state?.players)).toBe(true);

      const playerEntry = joinedPayload.state.players[0];
      expect(playerEntry).toBeDefined();
      expect(playerEntry.characteristicPoints).toEqual({
        total: 0,
        available: 0,
        spent: 0,
        perLevel: [],
      });
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
