import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Response as MiniflareResponse } from "miniflare";

import worker, { type Env } from "../src";
import * as observabilityModule from "../src/observability";

class MockWebSocket {
  accept = vi.fn();
  close = vi.fn();
  send = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

class MockWebSocketPair {
  static instances: MockWebSocketPair[] = [];

  0: MockWebSocket;
  1: MockWebSocket;

  constructor() {
    this[0] = new MockWebSocket();
    this[1] = new MockWebSocket();
    MockWebSocketPair.instances.push(this);
  }
}

describe("Worker fetch error handling", () => {
  const originalResponse = globalThis.Response;
  const originalWebSocketPair = (globalThis as { WebSocketPair?: unknown }).WebSocketPair;

  beforeEach(() => {
    MockWebSocketPair.instances = [];
    globalThis.Response = MiniflareResponse as unknown as typeof Response;
    (globalThis as { WebSocketPair?: unknown }).WebSocketPair = MockWebSocketPair as unknown;
  });

  afterEach(() => {
    globalThis.Response = originalResponse;
    if (originalWebSocketPair) {
      (globalThis as { WebSocketPair?: unknown }).WebSocketPair = originalWebSocketPair;
    } else {
      delete (globalThis as { WebSocketPair?: unknown }).WebSocketPair;
    }
    vi.restoreAllMocks();
  });

  it("logs the error and closes the socket with 1011 when stub.fetch rejects", async () => {
    const logError = vi.fn();
    const observability = {
      log: vi.fn(),
      logError,
      recordMetric: vi.fn()
    };

    vi.spyOn(observabilityModule, "createObservability").mockReturnValue(
      observability as unknown as ReturnType<typeof observabilityModule.createObservability>
    );

    const fetchError = new Error("stub failed");
    const stubFetch = vi.fn<[], Promise<Response>>(() => Promise.reject(fetchError));

    const env = {
      ROOM: {
        idFromName: vi.fn(() => ({})),
        get: vi.fn(() => ({ fetch: stubFetch }))
      }
    } as unknown as Env;

    const request = new Request("https://example.com/", {
      headers: {
        Upgrade: "websocket"
      }
    });

    const response = await worker.fetch(request, env);

    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      "ws_upgrade_forward_failed",
      fetchError,
      expect.objectContaining({
        roomId: "public-room",
        path: "/"
      })
    );

    expect(response.status).toBe(101);
    expect(MockWebSocketPair.instances).toHaveLength(1);
    const pair = MockWebSocketPair.instances[0];
    expect(response.webSocket).toBe(pair[0]);
    expect(pair[1].accept).toHaveBeenCalledTimes(1);
    expect(pair[1].close).toHaveBeenCalledWith(1011, "internal_error");
  });
});
