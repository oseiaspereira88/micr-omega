import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import type { ServerMessage, SharedGameStateDiff } from "@micr-omega/shared";
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

  it("skips sending diff updates when bufferedAmount exceeds configured limit", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.config.socketBufferedAmountLimitBytes = 100;

      const playerId = "player-1";
      const socket = {
        readyState: websocketMock.OPEN,
        bufferedAmount: 200,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      roomAny.clientsBySocket.set(socket, playerId);
      roomAny.activeSockets.add(socket);
      roomAny.socketsByPlayer.set(playerId, socket);

      const diffMessage = {
        type: "state",
        mode: "diff",
        state: {} as SharedGameStateDiff,
      } as ServerMessage;

      const originalObservability = roomAny.observability;
      const recordMetricSpy = vi.fn();
      const logSpy = vi.fn();
      roomAny.observability = {
        ...originalObservability,
        recordMetric: recordMetricSpy,
        log: logSpy,
      };

      roomAny.send(socket, diffMessage);

      expect(recordMetricSpy).toHaveBeenCalledWith(
        "socket_buffered_amount_exceeded",
        200,
        expect.objectContaining({
          action: "dropped",
          limit: 100,
          messageType: "state",
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        "debug",
        "socket_backpressure_skip_diff",
        expect.objectContaining({
          bufferedAmount: 200,
          limit: 100,
        }),
      );
      expect(socket.send).not.toHaveBeenCalled();
      expect(socket.close).not.toHaveBeenCalled();
      expect(roomAny.clientsBySocket.get(socket)).toBe(playerId);
      expect(roomAny.activeSockets.has(socket)).toBe(true);
      expect(roomAny.socketsByPlayer.get(playerId)).toBe(socket);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("closes sockets with backpressure reason for critical messages", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const mockState = new MockDurableObjectState();
      const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
      const roomAny = room as any;
      await roomAny.ready;

      roomAny.config.socketBufferedAmountLimitBytes = 100;

      const playerId = "player-2";
      const socket = {
        readyState: websocketMock.OPEN,
        bufferedAmount: 200,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;

      roomAny.clientsBySocket.set(socket, playerId);
      roomAny.activeSockets.add(socket);
      roomAny.socketsByPlayer.set(playerId, socket);

      const criticalMessage: ServerMessage = {
        type: "error",
        reason: "invalid_payload",
      };

      const originalObservability = roomAny.observability;
      const recordMetricSpy = vi.fn();
      const logSpy = vi.fn();
      roomAny.observability = {
        ...originalObservability,
        recordMetric: recordMetricSpy,
        log: logSpy,
      };

      roomAny.send(socket, criticalMessage);

      expect(recordMetricSpy).toHaveBeenCalledWith(
        "socket_buffered_amount_exceeded",
        200,
        expect.objectContaining({
          action: "closed",
          limit: 100,
          messageType: "error",
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "socket_backpressure_closing",
        expect.objectContaining({
          bufferedAmount: 200,
          limit: 100,
          playerId,
        }),
      );
      expect(socket.send).not.toHaveBeenCalled();
      expect(socket.close).toHaveBeenCalledWith(1013, "backpressure");
      expect(roomAny.clientsBySocket.has(socket)).toBe(false);
      expect(roomAny.activeSockets.has(socket)).toBe(false);
      expect(roomAny.socketsByPlayer.has(playerId)).toBe(false);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
