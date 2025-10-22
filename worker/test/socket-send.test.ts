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

  it("drops diff state messages when bufferedAmount exceeds the configured limit", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.config.socketBufferedAmountLimitBytes = 10;

      const playerId = "player-1";
      const logSpy = vi.fn();
      const recordMetricSpy = vi.fn();
      const originalObservability = roomAny.observability;
      roomAny.observability = {
        ...originalObservability,
        log: logSpy,
        recordMetric: recordMetricSpy,
      };

      const socket = {
        readyState: websocketMock.OPEN,
        bufferedAmount: 20,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      roomAny.clientsBySocket.set(socket, playerId);
      roomAny.activeSockets.add(socket);
      roomAny.socketsByPlayer.set(playerId, socket);

      const diffMessage = { type: "state", mode: "diff", state: {} } as unknown;
      roomAny.send(socket, diffMessage);

      expect(socket.send).not.toHaveBeenCalled();
      expect(socket.close).not.toHaveBeenCalled();
      expect(roomAny.clientsBySocket.has(socket)).toBe(true);
      expect(roomAny.activeSockets.has(socket)).toBe(true);
      expect(roomAny.socketsByPlayer.get(playerId)).toBe(socket);
      expect(recordMetricSpy).toHaveBeenCalledWith(
        "socket_buffer_pressure",
        20,
        expect.objectContaining({
          messageType: "state",
          policy: "drop_diff",
          playerId,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "socket_buffer_diff_dropped",
        expect.objectContaining({
          playerId,
          messageType: "state",
          bufferedAmount: 20,
        }),
      );
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("closes sockets with a specific reason when bufferedAmount remains high for critical messages", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.config.socketBufferedAmountLimitBytes = 10;

      const playerId = "player-1";
      const logSpy = vi.fn();
      const recordMetricSpy = vi.fn();
      const originalObservability = roomAny.observability;
      roomAny.observability = {
        ...originalObservability,
        log: logSpy,
        recordMetric: recordMetricSpy,
      };

      const closeSpy = vi.fn();
      const socket = {
        readyState: websocketMock.OPEN,
        bufferedAmount: 20,
        send: vi.fn(),
        close: closeSpy,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      roomAny.clientsBySocket.set(socket, playerId);
      roomAny.activeSockets.add(socket);
      roomAny.socketsByPlayer.set(playerId, socket);

      const criticalMessage = { type: "pong", ts: Date.now() };
      roomAny.send(socket, criticalMessage);

      expect(socket.send).not.toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalledWith(1013, "buffer_pressure");
      expect(roomAny.clientsBySocket.has(socket)).toBe(false);
      expect(roomAny.activeSockets.has(socket)).toBe(false);
      expect(roomAny.socketsByPlayer.has(playerId)).toBe(false);
      expect(recordMetricSpy).toHaveBeenCalledWith(
        "socket_buffer_pressure",
        20,
        expect.objectContaining({
          messageType: "pong",
          policy: "close_connection",
          playerId,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "socket_buffer_limit_exceeded",
        expect.objectContaining({
          playerId,
          messageType: "pong",
          bufferedAmount: 20,
        }),
      );
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
