import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serverMessageSchema } from "../utils/messageTypes";
import type { ClientMessage, SharedGameState } from "../utils/messageTypes";
import {
  computeReconnectDelay,
  prepareClientMessagePayload,
  resolveWebSocketUrl,
  useGameSocket,
  RECOVERABLE_ERROR_CLEAR_TIMEOUT_MS,
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

  it("keeps original host for Cloudflare Workers", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "my-app.account-name.workers.dev",
        protocol: "https:",
        port: ""
      }
    } as Window);

    expect(resolveWebSocketUrl()).toBe("wss://my-app.account-name.workers.dev");
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
  class MockWebSocket {
    static OPEN = 1;
    static instances: MockWebSocket[] = [];

    readyState = MockWebSocket.OPEN;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    close = vi.fn();
    send = vi.fn();

    constructor(public url: string) {
      MockWebSocket.instances.push(this);
    }
  }

  const createFullState = (): SharedGameState => ({
    phase: "waiting",
    roundId: null,
    roundStartedAt: null,
    roundEndsAt: null,
    players: [
      {
        id: "player-1",
        name: "Tester",
        connected: true,
        score: 0,
        combo: 0,
        lastActiveAt: 0,
        position: { x: 0, y: 0 },
        movementVector: { x: 0, y: 0 },
        orientation: { angle: 0 },
        health: { current: 100, max: 100 },
        combatStatus: {
          state: "idle",
          targetPlayerId: null,
          targetObjectId: null,
          lastAttackAt: null,
        },
        combatAttributes: { attack: 1, defense: 1, speed: 1, range: 1 },
        archetype: null,
        archetypeKey: null,
      },
    ],
    world: {
      microorganisms: [],
      organicMatter: [],
      obstacles: [],
      roomObjects: [],
    },
  });

  const setupSocketConnection = (options: { stubTimers?: boolean } = {}) => {
    const { stubTimers = true } = options;
    MockWebSocket.instances = [];

    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    if (stubTimers) {
      setTimeoutSpy.mockImplementation(
        ((_callback: Parameters<typeof window.setTimeout>[0]) =>
          1) as unknown as typeof window.setTimeout
      );
    }
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    if (stubTimers) {
      clearTimeoutSpy.mockImplementation(() => {});
    }
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    if (stubTimers) {
      setIntervalSpy.mockImplementation(
        ((_callback: Parameters<typeof window.setInterval>[0]) =>
          1) as unknown as typeof window.setInterval
      );
    }
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    if (stubTimers) {
      clearIntervalSpy.mockImplementation(() => {});
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    gameStore.setPartial({
      connectionStatus: "idle",
      reconnectAttempts: 0,
      reconnectUntil: null,
      playerId: null,
      playerName: null,
      reconnectToken: null,
      joinError: null,
    });

    const statusSpy = vi.spyOn(gameStore.actions, "setConnectionStatus");
    const incrementSpy = vi.spyOn(gameStore.actions, "incrementReconnectAttempts");

    const { result, unmount } = renderHook(() =>
      useGameSocket({ autoConnect: false, url: "ws://example.test" })
    );

    act(() => {
      result.current.connect("Tester");
    });

    const socket = MockWebSocket.instances.at(-1);
    if (!socket) {
      throw new Error("Expected WebSocket instance to be created");
    }

    act(() => {
      socket.onopen?.();
    });

    statusSpy.mockClear();
    incrementSpy.mockClear();

    return {
      socket,
      statusSpy,
      incrementSpy,
      setTimeoutSpy,
      clearTimeoutSpy,
      setIntervalSpy,
      clearIntervalSpy,
      unmount,
    };
  };

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
      reconnectToken: null,
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

  it.each<{
    reason: "invalid_payload" | "game_not_active" | "rate_limited";
    payload?: Partial<Extract<ReturnType<typeof serverMessageSchema["parse"]>, { type: "error" }>>;
    expectedMessage: string;
  }>([
    {
      reason: "invalid_payload",
      expectedMessage: "Erro ao comunicar com o servidor. Tente novamente.",
    },
    {
      reason: "game_not_active",
      expectedMessage: "A sala não está ativa no momento.",
    },
    {
      reason: "rate_limited",
      payload: { retryAfterMs: 3500 },
      expectedMessage:
        "Muitas mensagens enviadas. Aguarde 4s e tente novamente.",
    },
  ])(
    "keeps the socket open for recoverable error reason %s",
    ({ reason, payload, expectedMessage }) => {
      let restoreRandom: (() => void) | null = null;
      let restoreNow: (() => void) | null = null;
      let currentTime = Date.now();

      if (reason === "rate_limited") {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
        restoreRandom = () => randomSpy.mockRestore();

        currentTime = 1_000;
        const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => currentTime);
        restoreNow = () => nowSpy.mockRestore();
      }

      const {
        socket,
        statusSpy,
        incrementSpy,
        setTimeoutSpy,
        clearTimeoutSpy,
        setIntervalSpy,
        clearIntervalSpy,
        unmount,
      } = setupSocketConnection();

      try {
        act(() => {
          if (reason === "rate_limited") {
            currentTime = 1_500;
          }
          socket.onmessage?.({
            data: JSON.stringify({ type: "error", reason, ...payload }),
          } as MessageEvent<string>);
        });

        expect(gameStore.getState().joinError).toBe(expectedMessage);
        expect(socket.close).not.toHaveBeenCalled();
        expect(gameStore.getState().connectionStatus).toBe("connecting");
        expect(statusSpy).not.toHaveBeenCalled();
        expect(incrementSpy).not.toHaveBeenCalled();

        act(() => {
          if (reason === "rate_limited") {
            currentTime = 2_000;
          }
          socket.onclose?.();
        });

        expect(incrementSpy).toHaveBeenCalledTimes(1);
        expect(statusSpy).toHaveBeenCalledTimes(1);
        expect(statusSpy).toHaveBeenCalledWith("reconnecting");
        const expectedTimeoutCalls = reason === "invalid_payload" ? 1 : 2;
        expect(setTimeoutSpy).toHaveBeenCalledTimes(expectedTimeoutCalls);
        if (reason === "rate_limited") {
          const reconnectCall = setTimeoutSpy.mock.calls.at(-1);
          expect(reconnectCall?.[1]).toBe(3000);
        }
      } finally {
        if (restoreRandom) {
          restoreRandom();
        }
        if (restoreNow) {
          restoreNow();
        }
        statusSpy.mockRestore();
        incrementSpy.mockRestore();
        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
        unmount();
      }
    }
  );

  it("clears recoverable join errors when a valid state message is received", () => {
    vi.useFakeTimers();

    const {
      socket,
      setTimeoutSpy,
      clearTimeoutSpy,
      setIntervalSpy,
      clearIntervalSpy,
      unmount,
    } = setupSocketConnection({ stubTimers: false });

    try {
      act(() => {
        socket.onmessage?.({
          data: JSON.stringify({ type: "error", reason: "game_not_active" }),
        } as MessageEvent<string>);
      });

      expect(gameStore.getState().joinError).toBe("A sala não está ativa no momento.");
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        RECOVERABLE_ERROR_CLEAR_TIMEOUT_MS,
      );

      act(() => {
        socket.onmessage?.({
          data: JSON.stringify({ type: "state", mode: "full", state: createFullState() }),
        } as MessageEvent<string>);
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(gameStore.getState().joinError).toBeNull();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      unmount();
    }
  });

  it("removes transient join errors after the recovery timeout elapses", () => {
    vi.useFakeTimers();

    const {
      socket,
      setTimeoutSpy,
      clearTimeoutSpy,
      setIntervalSpy,
      clearIntervalSpy,
      unmount,
    } = setupSocketConnection({ stubTimers: false });

    try {
      act(() => {
        socket.onmessage?.({
          data: JSON.stringify({ type: "error", reason: "rate_limited" }),
        } as MessageEvent<string>);
      });

      expect(gameStore.getState().joinError).toBe(
        "Você está enviando mensagens muito rápido. Tente novamente em instantes.",
      );
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        RECOVERABLE_ERROR_CLEAR_TIMEOUT_MS,
      );

      act(() => {
        vi.advanceTimersByTime(RECOVERABLE_ERROR_CLEAR_TIMEOUT_MS);
      });

      expect(gameStore.getState().joinError).toBeNull();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      unmount();
    }
  });

  it("closes the socket for invalid_name errors", () => {
    const {
      socket,
      statusSpy,
      incrementSpy,
      setTimeoutSpy,
      clearTimeoutSpy,
      setIntervalSpy,
      clearIntervalSpy,
      unmount,
    } = setupSocketConnection();

    try {
      act(() => {
        socket.onmessage?.({
          data: JSON.stringify({ type: "error", reason: "invalid_name" }),
        } as MessageEvent<string>);
      });

      expect(gameStore.getState().joinError).toBe(
        "Nome inválido. Use entre 3 e 24 caracteres válidos."
      );
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith("disconnected");
      expect(incrementSpy).not.toHaveBeenCalled();
      expect(gameStore.getState().connectionStatus).toBe("disconnected");
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      statusSpy.mockRestore();
      incrementSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      unmount();
    }
  });

  it("reconnects automatically when receiving an unknown_player error", () => {
    MockWebSocket.instances = [];

    const setTimeoutSpy = vi
      .spyOn(window, "setTimeout")
      .mockImplementation((() => 1) as unknown as typeof window.setTimeout);
    const clearTimeoutSpy = vi
      .spyOn(window, "clearTimeout")
      .mockImplementation(() => {});
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation((() => 1) as unknown as typeof window.setInterval);
    const clearIntervalSpy = vi
      .spyOn(window, "clearInterval")
      .mockImplementation(() => {});

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    gameStore.setPartial({
      connectionStatus: "idle",
      reconnectAttempts: 0,
      reconnectUntil: null,
      playerId: null,
      playerName: null,
      reconnectToken: null,
      joinError: null,
    });

    const statusSpy = vi.spyOn(gameStore.actions, "setConnectionStatus");
    const setPlayerIdSpy = vi.spyOn(gameStore.actions, "setPlayerId");

    const { result, unmount } = renderHook(() =>
      useGameSocket({ autoConnect: false, url: "ws://example.test" })
    );

    try {
      act(() => {
        result.current.connect("Tester");
      });

      const firstSocket = MockWebSocket.instances.at(-1);
      if (!firstSocket) {
        throw new Error("Expected initial WebSocket instance");
      }

      act(() => {
        gameStore.actions.setPlayerId("stale-player");
      });

      act(() => {
        firstSocket.onopen?.();
      });

      statusSpy.mockClear();
      setPlayerIdSpy.mockClear();

      act(() => {
        firstSocket.onmessage?.({
          data: JSON.stringify({ type: "error", reason: "unknown_player" }),
        } as MessageEvent<string>);
      });

      const secondSocket = MockWebSocket.instances.at(-1);
      if (!secondSocket || secondSocket === firstSocket) {
        throw new Error("Expected a new WebSocket instance for reconnection");
      }

      expect(firstSocket.close).toHaveBeenCalledTimes(1);
      expect(setPlayerIdSpy).toHaveBeenCalledWith(null);
      expect(gameStore.getState().playerId).toBeNull();
      expect(gameStore.getState().reconnectToken).toBeNull();
      expect(gameStore.getState().joinError).toBeNull();
      expect(gameStore.getState().connectionStatus).toBe("reconnecting");
      expect(statusSpy).toHaveBeenCalledWith("reconnecting");

      secondSocket.send.mockClear();

      act(() => {
        secondSocket.onopen?.();
      });

      expect(secondSocket.send).toHaveBeenCalled();
      const joinPayload = JSON.parse(secondSocket.send.mock.calls[0]![0]);
      expect(joinPayload).toMatchObject({ type: "join", name: "Tester" });
      expect(joinPayload).not.toHaveProperty("playerId");
    } finally {
      statusSpy.mockRestore();
      setPlayerIdSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      unmount();
    }
  });

  it("closes the socket when an upgrade is required", () => {
    const {
      socket,
      statusSpy,
      incrementSpy,
      setTimeoutSpy,
      clearTimeoutSpy,
      setIntervalSpy,
      clearIntervalSpy,
      unmount,
    } = setupSocketConnection();

    try {
      act(() => {
        socket.onmessage?.({
          data: JSON.stringify({ type: "upgrade_required", minVersion: "2.0.0" }),
        } as MessageEvent<string>);
      });

      expect(gameStore.getState().joinError).toBe(
        "Versão desatualizada. Atualize a página para continuar."
      );
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith("disconnected");
      expect(incrementSpy).not.toHaveBeenCalled();
      expect(gameStore.getState().connectionStatus).toBe("disconnected");
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      statusSpy.mockRestore();
      incrementSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      unmount();
    }
  });
});
