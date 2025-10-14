import { useSyncExternalStore } from "react";
import {
  GamePhase,
  HealthState,
  Microorganism,
  OrganicMatter,
  Obstacle,
  OrientationState,
  RankingEntry,
  RoomObject,
  SharedGameState,
  SharedGameStateDiff,
  SharedPlayerState,
  SharedWorldState,
  SharedWorldStateDiff,
  Vector2,
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
  world: SharedWorldState;
}

const defaultRoomState: RoomStateSnapshot = {
  phase: "waiting",
  roundId: null,
  roundStartedAt: null,
  roundEndsAt: null,
};

const createEmptyWorldState = (): SharedWorldState => ({
  microorganisms: [],
  organicMatter: [],
  obstacles: [],
  roomObjects: [],
});

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
  world: createEmptyWorldState(),
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

const cloneVector = (vector: Vector2): Vector2 => ({ x: vector.x, y: vector.y });

const cloneOrientation = (orientation: OrientationState): OrientationState =>
  orientation.tilt === undefined
    ? { angle: orientation.angle }
    : { angle: orientation.angle, tilt: orientation.tilt };

const cloneHealth = (health: HealthState): HealthState => ({
  current: health.current,
  max: health.max,
});

const cloneMicroorganism = (entity: Microorganism): Microorganism => ({
  ...entity,
  position: cloneVector(entity.position),
  movementVector: cloneVector(entity.movementVector),
  orientation: cloneOrientation(entity.orientation),
  health: cloneHealth(entity.health),
  attributes: { ...entity.attributes },
});

const cloneOrganicMatter = (matter: OrganicMatter): OrganicMatter => ({
  ...matter,
  position: cloneVector(matter.position),
  nutrients: { ...matter.nutrients },
});

const cloneObstacle = (obstacle: Obstacle): Obstacle => ({
  ...obstacle,
  position: cloneVector(obstacle.position),
  size: cloneVector(obstacle.size),
  orientation: obstacle.orientation ? cloneOrientation(obstacle.orientation) : undefined,
});

const cloneRoomObject = (object: RoomObject): RoomObject => ({
  ...object,
  position: cloneVector(object.position),
  state: object.state ? { ...object.state } : undefined,
});

const cloneWorldState = (world: SharedWorldState): SharedWorldState => ({
  microorganisms: world.microorganisms.map(cloneMicroorganism),
  organicMatter: world.organicMatter.map(cloneOrganicMatter),
  obstacles: world.obstacles.map(cloneObstacle),
  roomObjects: world.roomObjects.map(cloneRoomObject),
});

const applyWorldCategoryDiff = <T extends { id: string }>(
  list: T[],
  upserts: readonly T[] | undefined,
  removals: readonly string[] | undefined,
  cloneItem: (item: T) => T,
): { changed: boolean; next: T[] } => {
  let changed = false;
  let result = list;

  if (upserts && upserts.length > 0) {
    const updatesById = new Map<string, T>();
    for (const item of upserts) {
      updatesById.set(item.id, cloneItem(item));
    }

    const merged: T[] = [];
    for (const item of list) {
      const update = updatesById.get(item.id);
      if (update) {
        merged.push(update);
        updatesById.delete(item.id);
        changed = true;
      } else {
        merged.push(item);
      }
    }

    if (updatesById.size > 0) {
      changed = true;
      for (const value of updatesById.values()) {
        merged.push(value);
      }
    }

    result = merged;
  }

  if (removals && removals.length > 0) {
    const removalSet = new Set(removals);
    const filtered = result.filter((item) => !removalSet.has(item.id));
    if (filtered.length !== result.length) {
      changed = true;
      result = filtered;
    }
  }

  return changed ? { changed: true, next: result } : { changed: false, next: list };
};

const applyWorldDiff = (
  world: SharedWorldState,
  diff: SharedWorldStateDiff | undefined,
): SharedWorldState => {
  if (!diff) {
    return world;
  }

  let mutated = false;
  let nextWorld = world;

  const ensureNextWorld = () => {
    if (!mutated) {
      nextWorld = {
        microorganisms: world.microorganisms,
        organicMatter: world.organicMatter,
        obstacles: world.obstacles,
        roomObjects: world.roomObjects,
      };
      mutated = true;
    }
    return nextWorld;
  };

  const microorganismsResult = applyWorldCategoryDiff(
    world.microorganisms,
    diff.upsertMicroorganisms,
    diff.removeMicroorganismIds,
    cloneMicroorganism,
  );
  if (microorganismsResult.changed) {
    const target = ensureNextWorld();
    target.microorganisms = microorganismsResult.next;
  }

  const organicMatterResult = applyWorldCategoryDiff(
    world.organicMatter,
    diff.upsertOrganicMatter,
    diff.removeOrganicMatterIds,
    cloneOrganicMatter,
  );
  if (organicMatterResult.changed) {
    const target = ensureNextWorld();
    target.organicMatter = organicMatterResult.next;
  }

  const obstacleResult = applyWorldCategoryDiff(
    world.obstacles,
    diff.upsertObstacles,
    diff.removeObstacleIds,
    cloneObstacle,
  );
  if (obstacleResult.changed) {
    const target = ensureNextWorld();
    target.obstacles = obstacleResult.next;
  }

  const roomObjectResult = applyWorldCategoryDiff(
    world.roomObjects,
    diff.upsertRoomObjects,
    diff.removeRoomObjectIds,
    cloneRoomObject,
  );
  if (roomObjectResult.changed) {
    const target = ensureNextWorld();
    target.roomObjects = roomObjectResult.next;
  }

  return mutated ? nextWorld : world;
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
    world: cloneWorldState(state.world),
  }));
};

const applyStateDiff = (diff: SharedGameStateDiff) => {
  applyState((prev) => ({
    ...prev,
    room: deriveRoomFromState(diff, prev.room),
    players: mergeDiffIntoPlayers(prev.players, diff),
    world: applyWorldDiff(prev.world, diff.world),
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
    world: createEmptyWorldState(),
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
