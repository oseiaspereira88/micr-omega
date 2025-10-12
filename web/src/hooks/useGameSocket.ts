import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ClientMessage,
  ErrorMessage,
  JoinMessage,
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

const resolveWebSocketUrl = (explicitUrl?: string) => {
  if (explicitUrl) {
    return explicitUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const envUrl =
    import.meta.env.VITE_REALTIME_URL ?? import.meta.env.VITE_WS_URL ?? "";

  if (envUrl) {
    return envUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/`;
};

const errorReasonToMessage = (error: ErrorMessage): string => {
  switch (error.reason) {
    case "invalid_name":
      return "Nome inválido. Use entre 3 e 24 caracteres válidos.";
    case "name_taken":
      return "Este nome já está em uso. Escolha outro.";
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

type UseGameSocketOptions = {
  url?: string;
  autoConnect?: boolean;
  pingInterval?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  version?: string;
};

type UseGameSocketResult = {
  send: (message: ClientMessage) => boolean;
  connect: (overrideName?: string) => void;
  disconnect: () => void;
  socket: WebSocket | null;
};

const useStableLatest = <T,>(value: T) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
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
  } = options;

  const playerName = useGameStore((state) => state.playerName);
  const playerId = useGameStore((state) => state.playerId);
  const connectionStatus = useGameStore((state) => state.connectionStatus);

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

  const sendMessage = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const validation = clientMessageSchema.safeParse(message);
    if (!validation.success) {
      console.error("Mensagem de cliente inválida antes do envio", validation.error);
      return false;
    }

    try {
      socket.send(JSON.stringify(validation.data));
      return true;
    } catch (err) {
      console.error("Não foi possível enviar mensagem ao servidor", err);
      return false;
    }
  }, []);

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
        gameStore.actions.setConnectionStatus("connected");
        gameStore.actions.setPlayerId(message.playerId);
        gameStore.actions.setJoinError(null);
        gameStore.actions.setReconnectUntil(message.reconnectUntil);
        gameStore.actions.setPlayerName(normalizedName);
        gameStore.actions.applyFullState(message.state);
        gameStore.actions.applyRanking(message.ranking);
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
      case "player_joined":
      case "player_left": {
        gameStore.actions.applyFullState(message.state);
        break;
      }
      case "error": {
        gameStore.actions.setJoinError(errorReasonToMessage(message));
        shouldReconnectRef.current = false;
        gameStore.actions.setConnectionStatus("disconnected");
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
        gameStore.actions.resetGameState();
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
            const delay = Math.min(
              reconnectBaseDelay * Math.pow(2, Math.max(0, attempts - 1)),
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
          const delay = Math.min(
            reconnectBaseDelay * Math.pow(2, Math.max(0, attempts - 1)),
            reconnectMaxDelay
          );

          if (typeof window !== "undefined") {
            reconnectTimerRef.current = window.setTimeout(() => {
              const connector = connectInternalRef.current;
              if (connector) {
                connector(sanitizedName, true);
              }
            }, delay);
          }
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

    connect(playerName);
  }, [autoConnect, connect, connectionStatus, playerName]);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    send: sendMessage,
    connect,
    disconnect,
    socket: socketRef.current,
  };
};
