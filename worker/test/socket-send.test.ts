import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

describe("RoomDO send", () => {
  it("logs errors, cleans up references and closes sockets when send fails", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      const playerId = "player-1";
      const sendError = new Error("send failed");
      const closeSpy = vi.fn();
      const socket = {
        readyState: websocketMock.OPEN,
        send: vi.fn(() => {
          throw sendError;
        }),
        close: closeSpy,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      roomAny.clientsBySocket.set(socket, playerId);
      roomAny.activeSockets.add(socket);
      roomAny.socketsByPlayer.set(playerId, socket);

      const originalObservability = roomAny.observability;
      const logErrorSpy = vi.fn();
      roomAny.observability = {
        ...originalObservability,
        logError: logErrorSpy,
      };

      roomAny.send(socket, { type: "pong", ts: Date.now() });

      expect(logErrorSpy).toHaveBeenCalledWith(
        "socket_send_failed",
        sendError,
        expect.objectContaining({
          playerId,
          messageType: "pong",
        }),
      );
      expect(roomAny.clientsBySocket.has(socket)).toBe(false);
      expect(roomAny.activeSockets.has(socket)).toBe(false);
      expect(roomAny.socketsByPlayer.has(playerId)).toBe(false);
      expect(closeSpy).toHaveBeenCalledWith(1011, "send_failed");
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
