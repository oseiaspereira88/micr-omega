import { useSyncExternalStore } from "react";
import {
  GamePhase,
  RankingEntry,
  SharedGameState,
  SharedGameStateDiff,
  SharedPlayerState,
} from "../utils/messageTypes";
import { reportRealtimeLatency } from "../utils/observability";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type PlayerMap = Record<string, SharedPlayerState>;

export interface RoomStateSnapshot {
  phase: GamePhase;
  roundId: string | null;
  roundStartedAt: number | null;
  roundEndsAt: number | null;
}

export interface GameStoreState {
  connectionStatus: ConnectionStatus;
  reconnectAttempts: number;
  reconnectUntil: number | null;
  playerId: string | null;
  playerName: string | null;
  joinError: string | null;
  lastPingAt: number | null;
  lastPongAt: number | null;
  room: RoomStateSnapshot;
  players: PlayerMap;
  ranking: RankingEntry[];
}

const defaultRoomState: RoomStateSnapshot = {
  phase: "waiting",
  roundId: null,
  roundStartedAt: null,
  roundEndsAt: null,
};

const initialState: GameStoreState = {
  connectionStatus: "idle",
  reconnectAttempts: 0,
  reconnectUntil: null,
  playerId: null,
  playerName: null,
  joinError: null,
  lastPingAt: null,
  lastPongAt: null,
  room: defaultRoomState,
  players: {},
  ranking: [],
};

type GameStoreListener = () => void;

type StateUpdater = (state: GameStoreState) => GameStoreState;

type StateSelector<T> = (state: GameStoreState) => T;

let currentState: GameStoreState = initialState;
const listeners = new Set<GameStoreListener>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const applyState = (updater: StateUpdater) => {
  const nextState = updater(currentState);
  if (nextState !== currentState) {
    currentState = nextState;
    notify();
  }
};

const playersArrayToMap = (players: SharedPlayerState[]): PlayerMap => {
  const record: PlayerMap = {};
  for (const player of players) {
    record[player.id] = player;
  }
  return record;
};

const mergeDiffIntoPlayers = (
  existing: PlayerMap,
  diff: SharedGameStateDiff
): PlayerMap => {
  let mutated = false;
  let nextPlayers: PlayerMap = existing;

  if (diff.upsertPlayers && diff.upsertPlayers.length > 0) {
    if (!mutated) {
      nextPlayers = { ...existing };
      mutated = true;
    }

    for (const player of diff.upsertPlayers) {
      nextPlayers[player.id] = player;
    }
  }

  if (diff.removedPlayerIds && diff.removedPlayerIds.length > 0) {
    if (!mutated) {
      nextPlayers = { ...existing };
      mutated = true;
    }

    for (const playerId of diff.removedPlayerIds) {
      if (playerId in nextPlayers) {
        delete nextPlayers[playerId];
      }
    }
  }

  return nextPlayers;
};

const isFullState = (
  state: SharedGameState | SharedGameStateDiff
): state is SharedGameState => Array.isArray((state as SharedGameState).players);

const deriveRoomFromState = (
  state: SharedGameState | SharedGameStateDiff,
  previousRoom: RoomStateSnapshot
): RoomStateSnapshot => {
  if (isFullState(state)) {
    return {
      phase: state.phase,
      roundId: state.roundId,
      roundStartedAt: state.roundStartedAt,
      roundEndsAt: state.roundEndsAt,
    };
  }

  const nextRoom: RoomStateSnapshot = { ...previousRoom };

  if (state.phase !== undefined) {
    nextRoom.phase = state.phase;
  }

  if (state.roundId !== undefined) {
    nextRoom.roundId = state.roundId;
  }

  if (state.roundStartedAt !== undefined) {
    nextRoom.roundStartedAt = state.roundStartedAt;
  }

  if (state.roundEndsAt !== undefined) {
    nextRoom.roundEndsAt = state.roundEndsAt;
  }

  return nextRoom;
};

const setConnectionStatus = (status: ConnectionStatus) => {
  applyState((prev) => {
    if (prev.connectionStatus === status) {
      return prev;
    }

    const next: GameStoreState = {
      ...prev,
      connectionStatus: status,
    };

    if (status === "connected") {
      next.reconnectAttempts = 0;
    }

    if (status === "disconnected") {
      next.reconnectUntil = null;
    }

    return next;
  });
};

const setPlayerName = (name: string | null) => {
  applyState((prev) => {
    if (prev.playerName === name) {
      return prev;
    }

    return {
      ...prev,
      playerName: name,
    };
  });
};

const setPlayerId = (playerId: string | null) => {
  applyState((prev) => {
    if (prev.playerId === playerId) {
      return prev;
    }

    return {
      ...prev,
      playerId,
    };
  });
};

const setJoinError = (message: string | null) => {
  applyState((prev) => {
    if (prev.joinError === message) {
      return prev;
    }

    return {
      ...prev,
      joinError: message,
    };
  });
};

const incrementReconnectAttempts = () => {
  let attempts = 0;
  applyState((prev) => {
    attempts = prev.reconnectAttempts + 1;
    return {
      ...prev,
      reconnectAttempts: attempts,
    };
  });
  return attempts;
};

const setReconnectUntil = (timestamp: number | null) => {
  applyState((prev) => {
    if (prev.reconnectUntil === timestamp) {
      return prev;
    }

    return {
      ...prev,
      reconnectUntil: timestamp,
    };
  });
};

const applyFullState = (state: SharedGameState) => {
  applyState((prev) => ({
    ...prev,
    room: {
      phase: state.phase,
      roundId: state.roundId,
      roundStartedAt: state.roundStartedAt,
      roundEndsAt: state.roundEndsAt,
    },
    players: playersArrayToMap(state.players),
  }));
};

const applyStateDiff = (diff: SharedGameStateDiff) => {
  applyState((prev) => ({
    ...prev,
    room: deriveRoomFromState(diff, prev.room),
    players: mergeDiffIntoPlayers(prev.players, diff),
  }));
};

const applyRanking = (ranking: RankingEntry[]) => {
  applyState((prev) => ({
    ...prev,
    ranking,
  }));
};

const markPing = (timestamp: number) => {
  applyState((prev) => ({
    ...prev,
    lastPingAt: timestamp,
  }));
};

const markPong = (timestamp: number) => {
  applyState((prev) => {
    const latency =
      typeof prev.lastPingAt === "number" ? Math.max(0, timestamp - prev.lastPingAt) : null;
    if (latency !== null) {
      reportRealtimeLatency(latency, { source: "ws", phase: prev.room.phase });
    }

    return {
      ...prev,
      lastPongAt: timestamp,
    };
  });
};

const resetGameState = () => {
  const preservedName = currentState.playerName;
  const preservedId = currentState.playerId;
  const preservedStatus = currentState.connectionStatus;
  const preservedReconnectUntil = currentState.reconnectUntil;
  applyState(() => ({
    ...initialState,
    playerName: preservedName,
    playerId: preservedId,
    connectionStatus: preservedStatus,
    reconnectUntil: preservedReconnectUntil,
  }));
};

export const gameStore = {
  getState: () => currentState,
  subscribe: (listener: GameStoreListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setState: applyState,
  setPartial: (partial: Partial<GameStoreState>) => {
    applyState((prev) => ({
      ...prev,
      ...partial,
    }));
  },
  actions: {
    setConnectionStatus,
    setPlayerName,
    setPlayerId,
    setJoinError,
    incrementReconnectAttempts,
    setReconnectUntil,
    applyFullState,
    applyStateDiff,
    applyRanking,
    markPing,
    markPong,
    resetGameState,
  },
};

export function useGameStore<T>(selector: StateSelector<T>): T {
  return useSyncExternalStore(
    gameStore.subscribe,
    () => selector(currentState),
    () => selector(initialState)
  );
}
