import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serverMessageSchema } from "../utils/messageTypes";
import type { ClientMessage } from "../utils/messageTypes";
import {
  computeReconnectDelay,
  prepareClientMessagePayload,
  resolveWebSocketUrl,
  useGameSocket
} from "./useGameSocket";
import { gameStore } from "../store/gameStore";
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveWebSocketUrl", () => {
  it("returns explicit url when provided", () => {
    expect(resolveWebSocketUrl("wss://custom.example.com/path/")).toBe(
      "wss://custom.example.com/path"
    );
  });

  it("converts https schemes to wss", () => {
    expect(resolveWebSocketUrl("https://api.example.com/ws")).toBe(
      "wss://api.example.com/ws"
    );
  });

  it("converts http schemes to ws", () => {
    expect(resolveWebSocketUrl("http://api.example.com/ws")).toBe(
      "ws://api.example.com/ws"
    );
  });

  it("derives realtime subdomain for standard domains", () => {
    vi.stubGlobal("window", {
      location: { hostname: "game.example.com", protocol: "https:", port: "" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://realtime.example.com");
  });

  it("preserves hosts that already include realtime label", () => {
    vi.stubGlobal("window", {
      location: { hostname: "realtime.example.com", protocol: "https:", port: "" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://realtime.example.com");
  });

  it("preserves nested hosts that include realtime label", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "beta.realtime.example.com",
        protocol: "https:",
        port: ""
      }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://beta.realtime.example.com");
  });

  it("keeps loopback-style localhost subdomains without realtime prefix", () => {
    vi.stubGlobal("window", {
      location: { hostname: "dev.localhost", protocol: "https:", port: "" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://dev.localhost");
  });

  it("keeps original host for known multi-tenant platforms", () => {
    vi.stubGlobal("window", {
      location: { hostname: "my-app.pages.dev", protocol: "https:", port: "" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://my-app.pages.dev");
  });

  it("keeps registrable domain for multi-level ccTLDs", () => {
    vi.stubGlobal("window", {
      location: { hostname: "arena.example.com.br", protocol: "https:", port: "" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://realtime.example.com.br");
  });

  it("handles secondary domains like co.uk", () => {
    vi.stubGlobal("window", {
      location: { hostname: "beta.service.co.uk", protocol: "https:", port: "" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://realtime.service.co.uk");
  });

  it("preserves numeric hosts when running on private networks", () => {
    vi.stubGlobal("window", {
      location: { hostname: "192.168.0.10", protocol: "http:", port: "5173" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("ws://192.168.0.10:5173");
  });

  it("wraps IPv6 hosts with brackets when building the URL", () => {
    vi.stubGlobal("window", {
      location: { hostname: "::1", protocol: "http:", port: "8787" }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("ws://[::1]:8787");
  });

  it("falls back to host when window is unavailable", () => {
    vi.stubGlobal("window", undefined as unknown as Window);
    expect(resolveWebSocketUrl()).toBe("");
  });
});

describe("prepareClientMessagePayload", () => {
  const originalError = console.error;

  afterEach(() => {
    console.error = originalError;
  });

  it("validates messages when validation is enabled", () => {
    const spy = vi.fn();
    console.error = spy;

    const invalidMessage = { type: "movement" } as unknown as ClientMessage;
    const payload = prepareClientMessagePayload(invalidMessage, true);

    expect(payload).toBeNull();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("returns validated payload when message is valid", () => {
    const spy = vi.fn();
    console.error = spy;

    const validMessage: ClientMessage = { type: "ping", ts: Date.now() };
    const payload = prepareClientMessagePayload(validMessage, true);

    expect(payload).toEqual(validMessage);
    expect(spy).not.toHaveBeenCalled();
  });

  it("permite mensagens de dash sem alvo explícito", () => {
    const message: ClientMessage = {
      type: "attack",
      playerId: "player-1",
      kind: "dash",
      clientTime: Date.now(),
    };

    const payload = prepareClientMessagePayload(message, true);

    expect(payload).toEqual(message);
  });

  it("skips validation when disabled", () => {
    const spy = vi.fn();
    console.error = spy;

    const invalidMessage = { type: "movement" } as unknown as ClientMessage;
    const payload = prepareClientMessagePayload(invalidMessage, false);

    expect(payload).toBe(invalidMessage);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("computeReconnectDelay", () => {
  const baseDelay = 1500;
  const maxDelay = 12000;

  it("applies the minimum jitter factor", () => {
    const delay = computeReconnectDelay(1, baseDelay, maxDelay, () => 0);
    expect(delay).toBe(baseDelay * 0.5);
  });

  it("respects the maximum cap when jitter increases the delay", () => {
    const delay = computeReconnectDelay(6, baseDelay, maxDelay, () => 1);
    expect(delay).toBe(maxDelay);
  });

  it("applies intermediate jitter values deterministically", () => {
    const delay = computeReconnectDelay(3, baseDelay, maxDelay, () => 0.25);
    const baseForAttempt = baseDelay * Math.pow(2, 2);
    expect(delay).toBe(baseForAttempt * 0.75);
  });
});

describe("serverMessageSchema", () => {
  it("accepts state diff messages with player removals", () => {
    const message = {
      type: "state" as const,
      mode: "diff" as const,
      state: { removedPlayerIds: ["player-1"] }
    };

    const result = serverMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it("rejects legacy player join events with full snapshots", () => {
    const message = {
      type: "player_joined",
      playerId: "player-1",
      name: "Player",
      state: {
        phase: "waiting",
        roundId: null,
        roundStartedAt: null,
        roundEndsAt: null,
        players: [],
        world: {
          microorganisms: [],
          organicMatter: [],
          obstacles: [],
          roomObjects: []
        }
      }
    };

    const result = serverMessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });
});

describe("useGameSocket", () => {
  it("sets status to reconnecting when the initial connection fails and reconnection is enabled", () => {
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    timeoutSpy.mockImplementation((() => 1) as unknown as Window["setTimeout"]);

    class ThrowingWebSocket {
      static OPEN = 1;
      constructor() {
        throw new Error("fail");
      }
    }

    vi.stubGlobal("WebSocket", ThrowingWebSocket as unknown as typeof WebSocket);

    const statusSpy = vi.spyOn(gameStore.actions, "setConnectionStatus");
    const reconnectSpy = vi.spyOn(gameStore.actions, "incrementReconnectAttempts");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    gameStore.setPartial({
      playerName: "Tester",
      reconnectAttempts: 0,
      connectionStatus: "idle",
      joinError: null,
    });

    try {
      const { result } = renderHook(() =>
        useGameSocket({ autoConnect: false, url: "ws://example.test" })
      );

      statusSpy.mockClear();
      reconnectSpy.mockClear();

      act(() => {
        result.current.connect();
      });

      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith("reconnecting");
      expect(timeoutSpy).toHaveBeenCalledTimes(1);
    } finally {
      consoleSpy.mockRestore();
      statusSpy.mockRestore();
      reconnectSpy.mockRestore();
      timeoutSpy.mockRestore();
    }
  });
});
