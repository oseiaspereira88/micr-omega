import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AttackMessage,
  ClientMessage,
  ErrorMessage,
  JoinMessage,
  MovementMessage,
  ServerMessage,
  clientMessageSchema,
  serverMessageSchema,
  sanitizePlayerName,
  sanitizePlayerId,
} from "../utils/messageTypes";
import { gameStore, useGameStore } from "../store/gameStore";

const DEFAULT_PING_INTERVAL = 15000;
const DEFAULT_RECONNECT_BASE = 1500;
const DEFAULT_RECONNECT_MAX = 12000;
const RECONNECT_JITTER_MIN = 0.5;
const RECONNECT_JITTER_MAX = 1.5;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const computeJitterFactor = (randomFn: () => number) => {
  const raw = clamp(randomFn(), 0, 1);
  const jitterRange = RECONNECT_JITTER_MAX - RECONNECT_JITTER_MIN;
  return RECONNECT_JITTER_MIN + raw * jitterRange;
};

export const computeReconnectDelay = (
  attempts: number,
  reconnectBaseDelay: number,
  reconnectMaxDelay: number,
  randomFn: () => number = Math.random
) => {
  const exponentialDelay = reconnectBaseDelay * Math.pow(2, Math.max(0, attempts - 1));
  const cappedDelay = Math.min(exponentialDelay, reconnectMaxDelay);
  const jitterFactor = computeJitterFactor(randomFn);
  const jitteredDelay = cappedDelay * jitterFactor;

  return Math.min(jitteredDelay, reconnectMaxDelay);
};

const normalizeRealtimeUrl = (url: string) => url.trim().replace(/\/+$/, "");

const convertHttpUrlToWebSocket = (url: string) => {
  const trimmedUrl = url.trim();
  const lowerCaseUrl = trimmedUrl.toLowerCase();

  if (lowerCaseUrl.startsWith("https://")) {
    return `wss://${trimmedUrl.slice("https://".length)}`;
  }

  if (lowerCaseUrl.startsWith("http://")) {
    return `ws://${trimmedUrl.slice("http://".length)}`;
  }

  return trimmedUrl;
};

const SECOND_LEVEL_DOMAINS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gov",
  "id",
  "me",
  "mil",
  "net",
  "nom",
  "org"
]);

const IPV4_SEGMENT = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

const isIpv4Address = (hostname: string) => {
  const segments = hostname.split(".");
  if (segments.length !== 4) {
    return false;
  }

  return segments.every((segment) => IPV4_SEGMENT.test(segment));
};

const isIpAddress = (hostname: string) => {
  if (!hostname) {
    return false;
  }

  if (hostname.includes(":")) {
    // Covers IPv6 literals (with or without square brackets) and mixed formats.
    return true;
  }

  return isIpv4Address(hostname);
};

const MULTI_TENANT_HOST_SUFFIXES = new Set([
  "pages.dev",
  "vercel.app",
  "netlify.app",
  "surge.sh",
  "cloudflareapps.com"
]);

const formatHostnameForWebSocket = (hostname: string) => {
  if (!hostname.includes(":")) {
    return hostname;
  }

  const unwrappedHostname = hostname.replace(/^\[/, "").replace(/\]$/, "");
  return `[${unwrappedHostname}]`;
};

export const resolveWebSocketUrl = (explicitUrl?: string) => {
  if (explicitUrl) {
    return normalizeRealtimeUrl(convertHttpUrlToWebSocket(explicitUrl));
  }

  if (typeof window === "undefined") {
    return "";
  }

  const envUrl =
    import.meta.env.VITE_REALTIME_URL ?? import.meta.env.VITE_WS_URL ?? "";

  if (envUrl) {
    return normalizeRealtimeUrl(convertHttpUrlToWebSocket(envUrl));
  }

  const { hostname, protocol, port } = window.location;
  const websocketProtocol = protocol === "https:" ? "wss:" : "ws:";

  const normalizedHostname = hostname.toLowerCase();
  const isLoopbackHost =
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(normalizedHostname) ||
    normalizedHostname.endsWith(".localhost");

  if (isLoopbackHost) {
    const portSuffix = port ? `:${port}` : "";
    return `${websocketProtocol}//${formatHostnameForWebSocket(hostname)}${portSuffix}`;
  }

  if (isIpAddress(hostname)) {
    const portSuffix = port ? `:${port}` : "";
    return `${websocketProtocol}//${formatHostnameForWebSocket(hostname)}${portSuffix}`;
  }

  const matchesMultiTenantSuffix = (() => {
    for (const suffix of MULTI_TENANT_HOST_SUFFIXES) {
      if (
        normalizedHostname === suffix ||
        normalizedHostname.endsWith(`.${suffix}`)
      ) {
        return true;
      }
    }
    return false;
  })();

  if (matchesMultiTenantSuffix) {
    return `${websocketProtocol}//${formatHostnameForWebSocket(hostname)}`;
  }

  const hostnameParts = hostname.split(".").filter(Boolean);
  const hasRealtimeLabel = hostnameParts.some(
    (part) => part.toLowerCase() === "realtime"
  );

  if (hasRealtimeLabel) {
    return `${websocketProtocol}//${formatHostnameForWebSocket(hostname)}`;
  }

  let apexDomain = hostname;

  if (hostnameParts.length >= 2) {
    const tld = hostnameParts.at(-1) ?? "";
    const secondLevel = hostnameParts.at(-2)?.toLowerCase();
    const requiresThirdLevel =
      hostnameParts.length >= 3 &&
      tld.length === 2 &&
      !!secondLevel &&
      SECOND_LEVEL_DOMAINS.has(secondLevel);

    const sliceStart = requiresThirdLevel ? -3 : -2;
    apexDomain = hostnameParts.slice(sliceStart).join(".");
  }

  return `${websocketProtocol}//realtime.${apexDomain}`;
};

const errorReasonToMessage = (error: ErrorMessage): string => {
  switch (error.reason) {
    case "invalid_name":
      return "Nome inválido. Use entre 3 e 24 caracteres válidos.";
    case "name_taken":
      return "Este nome já está em uso. Digite outro nome ou saia da sala atual.";
    case "unknown_player":
      return "Jogador desconhecido. Tente reconectar.";
    case "game_not_active":
      return "A sala não está ativa no momento.";
    case "room_full":
      return "A sala está cheia no momento. Aguarde uma vaga.";
    case "rate_limited": {
      const seconds = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : null;
      if (seconds && seconds > 0) {
        return `Muitas mensagens enviadas. Aguarde ${seconds}s e tente novamente.`;
      }
      return "Você está enviando mensagens muito rápido. Tente novamente em instantes.";
    }
    case "invalid_payload":
    default:
      return "Erro ao comunicar com o servidor. Tente novamente.";
  }
};

const RECOVERABLE_ERROR_REASONS: ReadonlySet<ErrorMessage["reason"]> = new Set([
  "invalid_payload",
  "game_not_active",
  "rate_limited",
  "unknown_player",
]);

type UseGameSocketOptions = {
  url?: string;
  autoConnect?: boolean;
  pingInterval?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  version?: string;
  validateMessages?: boolean;
};

type MovementCommand = Omit<MovementMessage, "type" | "playerId"> & { playerId?: string | null };
type AttackCommand = Omit<AttackMessage, "type" | "playerId"> & { playerId?: string | null };

type UseGameSocketResult = {
  send: (message: ClientMessage) => boolean;
  sendMovement: (command: MovementCommand) => boolean;
  sendAttack: (command: AttackCommand) => boolean;
  connect: (overrideName?: string) => void;
  disconnect: () => void;
  socket: WebSocket | null;
};

const useStableLatest = <T,>(value: T) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

export const prepareClientMessagePayload = (
  message: ClientMessage,
  shouldValidate: boolean,
): ClientMessage | null => {
  if (!shouldValidate) {
    return message;
  }

  const validation = clientMessageSchema.safeParse(message);
  if (!validation.success) {
    console.error("Mensagem de cliente inválida antes do envio", validation.error);
    return null;
  }

  return validation.data;
};

export const useGameSocket = (
  options: UseGameSocketOptions = {}
): UseGameSocketResult => {
  const {
    autoConnect = true,
    pingInterval = DEFAULT_PING_INTERVAL,
    reconnectBaseDelay = DEFAULT_RECONNECT_BASE,
    reconnectMaxDelay = DEFAULT_RECONNECT_MAX,
    url,
    version,
    validateMessages = import.meta.env.DEV,
  } = options;

  const playerName = useGameStore((state) => state.playerName);
  const playerId = useGameStore((state) => state.playerId);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const joinError = useGameStore((state) => state.joinError);

  const playerNameRef = useStableLatest(playerName);
  const playerIdRef = useStableLatest(playerId);

  const effectiveUrl = useMemo(() => resolveWebSocketUrl(url), [url]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const lastRequestedNameRef = useRef<string | null>(null);
  const connectInternalRef = useRef<(name: string, isReconnect: boolean) => void>();

  const clearReconnectTimer = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearPingTimer = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    (message: ClientMessage) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }

      const payload = prepareClientMessagePayload(message, validateMessages);
      if (!payload) {
        return false;
      }

      try {
        socket.send(JSON.stringify(payload));
        return true;
      } catch (err) {
        console.error("Não foi possível enviar mensagem ao servidor", err);
        return false;
      }
    },
    [validateMessages],
  );

  const resolveCommandPlayerId = useCallback(
    (candidate?: string | null) => {
      const explicit = candidate ?? playerIdRef.current;
      if (!explicit) {
        return null;
      }

      const sanitized = sanitizePlayerId(explicit);
      if (!sanitized) {
        console.warn("Identificador de jogador inválido descartado antes do envio");
        return null;
      }

      return sanitized;
    },
    [playerIdRef],
  );

  const sendMovementCommand = useCallback(
    (command: MovementCommand) => {
      const playerId = resolveCommandPlayerId(command.playerId);
      if (!playerId) {
        return false;
      }

      const message: MovementMessage = {
        type: "movement",
        playerId,
        position: command.position,
        movementVector: command.movementVector,
        orientation: command.orientation,
      };

      if (command.clientTime !== undefined) {
        message.clientTime = command.clientTime;
      }

      return sendMessage(message);
    },
    [resolveCommandPlayerId, sendMessage],
  );

  const sendAttackCommand = useCallback(
    (command: AttackCommand) => {
      const playerId = resolveCommandPlayerId(command.playerId);
      if (!playerId) {
        return false;
      }

      const message: AttackMessage = {
        type: "attack",
        playerId,
        kind: command.kind,
        targetPlayerId: command.targetPlayerId,
        targetObjectId: command.targetObjectId,
      };

      if (command.damage !== undefined) {
        message.damage = command.damage;
      }
      if (command.state !== undefined) {
        message.state = command.state;
      }
      if (command.resultingHealth !== undefined) {
        message.resultingHealth = command.resultingHealth;
      }
      if (command.clientTime !== undefined) {
        message.clientTime = command.clientTime;
      }

      return sendMessage(message);
    },
    [resolveCommandPlayerId, sendMessage],
  );

  const startHeartbeat = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sendPing = () => {
      const ts = Date.now();
      if (sendMessage({ type: "ping", ts })) {
        gameStore.actions.markPing(ts);
      }
    };

    clearPingTimer();
    sendPing();
    pingTimerRef.current = window.setInterval(sendPing, pingInterval);
  }, [clearPingTimer, pingInterval, sendMessage]);

  const stopSocket = useCallback((closeConnection = true) => {
    clearPingTimer();
    clearReconnectTimer();

    const socket = socketRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (closeConnection) {
        try {
          socket.close();
        } catch (err) {
          console.error("Erro ao fechar WebSocket", err);
        }
      }
    }

    socketRef.current = null;
  }, [clearPingTimer, clearReconnectTimer]);

  const handleServerMessage = useCallback((raw: MessageEvent<string>) => {
    let message: ServerMessage;

    try {
      const json = JSON.parse(raw.data);
      const validation = serverMessageSchema.safeParse(json);
      if (!validation.success) {
        throw new Error(validation.error.message);
      }
      message = validation.data;
    } catch (err) {
      console.error("Não foi possível interpretar mensagem do servidor", err);
      return;
    }

    switch (message.type) {
      case "joined": {
        const normalizedName =
          message.state.players.find((player) => player.id === message.playerId)?.name ??
          playerNameRef.current ??
          "";

        lastRequestedNameRef.current = normalizedName;
        gameStore.actions.applyJoinedSnapshot({
          playerId: message.playerId,
          playerName: normalizedName,
          reconnectUntil: message.reconnectUntil,
          state: message.state,
          ranking: message.ranking,
        });
        break;
      }
      case "state": {
        if (message.mode === "full") {
          gameStore.actions.applyFullState(message.state);
        } else {
          gameStore.actions.applyStateDiff(message.state);
        }
        break;
      }
      case "ranking": {
        gameStore.actions.applyRanking(message.ranking);
        break;
      }
      case "pong": {
        gameStore.actions.markPong(message.ts);
        break;
      }
      case "reset": {
        gameStore.actions.applyFullState(message.state);
        break;
      }
      case "error": {
        const isRecoverable = RECOVERABLE_ERROR_REASONS.has(message.reason);
        gameStore.actions.setJoinError(errorReasonToMessage(message));
        if (isRecoverable) {
          break;
        }

        shouldReconnectRef.current = false;
        gameStore.actions.setConnectionStatus("disconnected");
        lastRequestedNameRef.current = null;
        stopSocket();
        break;
      }
      case "upgrade_required": {
        gameStore.actions.setJoinError(
          "Versão desatualizada. Atualize a página para continuar."
        );
        shouldReconnectRef.current = false;
        gameStore.actions.setConnectionStatus("disconnected");
        stopSocket();
        break;
      }
      default:
        break;
    }
  }, [playerNameRef, stopSocket]);

  const connectInternal = useCallback(
    (name: string, isReconnect: boolean) => {
      if (typeof window === "undefined" || !effectiveUrl) {
        return;
      }

      const sanitizedName = sanitizePlayerName(name);
      if (!sanitizedName) {
        gameStore.actions.setJoinError("Nome inválido. Use entre 3 e 24 caracteres válidos.");
        gameStore.actions.setConnectionStatus("disconnected");
        return;
      }

      shouldReconnectRef.current = true;
      stopSocket();

      try {
        const socket = new WebSocket(effectiveUrl);
        socketRef.current = socket;
        lastRequestedNameRef.current = sanitizedName;
        gameStore.actions.setConnectionStatus(
          isReconnect ? "reconnecting" : "connecting"
        );
        gameStore.actions.setJoinError(null);
        if (!isReconnect) {
          gameStore.actions.resetGameState();
        }
        gameStore.actions.setPlayerName(sanitizedName);

        socket.onopen = () => {
          const joinMessage: JoinMessage = {
            type: "join",
            name: sanitizedName,
          };

          const knownId = playerIdRef.current;
          if (knownId) {
            const sanitizedId = sanitizePlayerId(knownId);
            if (!sanitizedId) {
              console.error("Identificador de jogador inválido descartado antes do envio");
            } else {
              joinMessage.playerId = sanitizedId;
            }
          }

          if (version) {
            joinMessage.version = version;
          }

          if (!sendMessage(joinMessage)) {
            console.error("Falha ao enviar join após validação");
            return;
          }

          startHeartbeat();
        };

        socket.onmessage = handleServerMessage as (event: MessageEvent) => void;

        socket.onclose = () => {
          stopSocket(false);
          if (shouldReconnectRef.current && lastRequestedNameRef.current) {
            const scheduledName = lastRequestedNameRef.current;
            const attempts = gameStore.actions.incrementReconnectAttempts();
            const delay = computeReconnectDelay(
              attempts,
              reconnectBaseDelay,
              reconnectMaxDelay
            );

            if (typeof window !== "undefined") {
              gameStore.actions.setConnectionStatus("reconnecting");
              reconnectTimerRef.current = window.setTimeout(() => {
                const connector = connectInternalRef.current;
                if (connector) {
                  connector(scheduledName, true);
                }
              }, delay);
            }
          } else {
            gameStore.actions.setConnectionStatus("disconnected");
          }
        };

        socket.onerror = () => {
          gameStore.actions.setConnectionStatus("disconnected");
        };
      } catch (err) {
        console.error("Não foi possível abrir WebSocket", err);
        if (shouldReconnectRef.current) {
          const attempts = gameStore.actions.incrementReconnectAttempts();
          const delay = computeReconnectDelay(
            attempts,
            reconnectBaseDelay,
            reconnectMaxDelay
          );

          if (typeof window !== "undefined") {
            gameStore.actions.setConnectionStatus("reconnecting");
            reconnectTimerRef.current = window.setTimeout(() => {
              const connector = connectInternalRef.current;
              if (connector) {
                connector(sanitizedName, true);
              }
            }, delay);
          }
        } else {
          gameStore.actions.setConnectionStatus("disconnected");
        }
      }
    },
    [
      effectiveUrl,
      handleServerMessage,
      reconnectBaseDelay,
      reconnectMaxDelay,
      startHeartbeat,
      stopSocket,
      playerIdRef,
      version,
      sendMessage,
    ]
  );

  connectInternalRef.current = connectInternal;

  const connect = useCallback(
    (overrideName?: string) => {
      const name = overrideName ?? playerNameRef.current ?? "";
      if (!name) {
        return;
      }

      connectInternal(name, false);
    },
    [connectInternal, playerNameRef]
  );

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    stopSocket();
    gameStore.actions.setConnectionStatus("disconnected");
  }, [stopSocket]);

  useEffect(() => {
    if (!autoConnect) {
      return;
    }

    if (!playerName) {
      return;
    }

    if (
      connectionStatus === "connected" ||
      connectionStatus === "connecting" ||
      connectionStatus === "reconnecting"
    ) {
      return;
    }

    if (joinError) {
      return;
    }

    connect(playerName);
  }, [autoConnect, connect, connectionStatus, joinError, playerName]);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    send: sendMessage,
    sendMovement: sendMovementCommand,
    sendAttack: sendAttackCommand,
    connect,
    disconnect,
    socket: socketRef.current,
  };
};
