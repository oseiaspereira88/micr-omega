import { useRef, useSyncExternalStore } from "react";
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
  SharedProgressionState,
  SharedProgressionStream,
  Vector2,
  StatusEffectEvent,
} from "../utils/messageTypes";
import { reportRealtimeLatency } from "../utils/observability";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type PlayerMap = Record<string, SharedPlayerState>;

export type EntityCollection<T extends { id: string }> = {
  byId: Record<string, T>;
  all: T[];
  indexById: Map<string, number>;
};

type WorldCollections = {
  microorganisms: EntityCollection<Microorganism>;
  organicMatter: EntityCollection<OrganicMatter>;
  obstacles: EntityCollection<Obstacle>;
  roomObjects: EntityCollection<RoomObject>;
};

type DerivedSynchronizedState = Pick<
  GameStoreState,
  | "room"
  | "players"
  | "remotePlayers"
  | "microorganisms"
  | "organicMatter"
  | "obstacles"
  | "roomObjects"
  | "world"
  | "progression"
>;

const createEmptyEntityCollection = <T extends { id: string }>(): EntityCollection<T> => ({
  byId: {},
  all: [],
  indexById: new Map(),
});

const createEntityCollectionFromArray = <T extends { id: string }>(
  items: readonly T[],
  cloneItem: (item: T) => T,
): EntityCollection<T> => {
  const all = items.map((item) => cloneItem(item));
  const byId: Record<string, T> = {};
  const indexById = new Map<string, number>();
  for (let index = 0; index < all.length; index += 1) {
    const item = all[index]!;
    byId[item.id] = item;
    indexById.set(item.id, index);
  }
  return { byId, all, indexById };
};

const applyEntityCollectionDiff = <T extends { id: string }>(
  collection: EntityCollection<T>,
  upserts: readonly T[] | undefined,
  removals: readonly string[] | undefined,
  cloneItem: (item: T) => T,
): { next: EntityCollection<T>; changed: boolean } => {
  let nextAll = collection.all;
  let nextById = collection.byId;
  let nextIndexById = collection.indexById;
  let changed = false;

  let arrayCloned = false;
  let byIdCloned = false;
  let indexCloned = false;

  const ensureArray = () => {
    if (!arrayCloned) {
      nextAll = collection.all.slice();
      arrayCloned = true;
    }
  };

  const ensureById = () => {
    if (!byIdCloned) {
      nextById = { ...collection.byId };
      byIdCloned = true;
    }
  };

  const ensureIndex = () => {
    if (!indexCloned) {
      nextIndexById = new Map(collection.indexById);
      indexCloned = true;
    }
  };

  if (upserts && upserts.length > 0) {
    for (const entry of upserts) {
      const cloned = cloneItem(entry);
      const existingIndex = nextIndexById.get(cloned.id);
      if (existingIndex !== undefined) {
        ensureArray();
        ensureById();
        nextAll[existingIndex] = cloned;
        nextById[cloned.id] = cloned;
      } else {
        ensureArray();
        ensureById();
        ensureIndex();
        const newIndex = nextAll.length;
        nextAll.push(cloned);
        nextById[cloned.id] = cloned;
        nextIndexById.set(cloned.id, newIndex);
      }
      changed = true;
    }
  }

  if (removals && removals.length > 0) {
    const removalSet = new Set(removals);
    if (removalSet.size > 0) {
      const indicesToRemove: number[] = [];
      for (const id of removalSet) {
        const index = nextIndexById.get(id);
        if (index !== undefined) {
          ensureById();
          ensureIndex();
          delete nextById[id];
          nextIndexById.delete(id);
          indicesToRemove.push(index);
        }
      }

      if (indicesToRemove.length > 0) {
        ensureArray();
        indicesToRemove.sort((a, b) => a - b);
        for (let i = indicesToRemove.length - 1; i >= 0; i -= 1) {
          const index = indicesToRemove[i]!;
          nextAll.splice(index, 1);
        }

        const minIndex = indicesToRemove[0]!;
        for (let i = minIndex; i < nextAll.length; i += 1) {
          const item = nextAll[i]!;
          nextIndexById.set(item.id, i);
        }

        changed = true;
      }
    }
  }

  if (!changed) {
    return { next: collection, changed: false };
  }

  return {
    next: {
      byId: nextById,
      all: nextAll,
      indexById: nextIndexById,
    },
    changed: true,
  };
};

const createEmptyWorldCollections = (): WorldCollections => ({
  microorganisms: createEmptyEntityCollection<Microorganism>(),
  organicMatter: createEmptyEntityCollection<OrganicMatter>(),
  obstacles: createEmptyEntityCollection<Obstacle>(),
  roomObjects: createEmptyEntityCollection<RoomObject>(),
});

const buildWorldFromCollections = (collections: WorldCollections): SharedWorldState => ({
  microorganisms: collections.microorganisms.all,
  organicMatter: collections.organicMatter.all,
  obstacles: collections.obstacles.all,
  roomObjects: collections.roomObjects.all,
});

const deriveSynchronizedStateFromFullSnapshot = (
  state: SharedGameState,
): DerivedSynchronizedState => {
  const remotePlayers = createEntityCollectionFromArray(state.players, clonePlayer);
  const worldCollections: WorldCollections = {
    microorganisms: createEntityCollectionFromArray(
      state.world.microorganisms,
      cloneMicroorganism,
    ),
    organicMatter: createEntityCollectionFromArray(state.world.organicMatter, cloneOrganicMatter),
    obstacles: createEntityCollectionFromArray(state.world.obstacles, cloneObstacle),
    roomObjects: createEntityCollectionFromArray(state.world.roomObjects, cloneRoomObject),
  };

  return {
    room: {
      phase: state.phase,
      roundId: state.roundId,
      roundStartedAt: state.roundStartedAt,
      roundEndsAt: state.roundEndsAt,
    },
    players: remotePlayers.byId,
    remotePlayers,
    microorganisms: worldCollections.microorganisms,
    organicMatter: worldCollections.organicMatter,
    obstacles: worldCollections.obstacles,
    roomObjects: worldCollections.roomObjects,
    world: buildWorldFromCollections(worldCollections),
    progression: cloneProgressionState(state.progression),
  };
};

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
  remotePlayers: EntityCollection<SharedPlayerState>;
  ranking: RankingEntry[];
  microorganisms: EntityCollection<Microorganism>;
  organicMatter: EntityCollection<OrganicMatter>;
  obstacles: EntityCollection<Obstacle>;
  roomObjects: EntityCollection<RoomObject>;
  world: SharedWorldState;
  progression: SharedProgressionState;
  statusEffects: StatusEffectEvent[];
}

const cloneVector = (vector: Vector2): Vector2 => ({ x: vector.x, y: vector.y });

const cloneOrientation = (orientation: OrientationState): OrientationState =>
  orientation.tilt === undefined
    ? { angle: orientation.angle }
    : { angle: orientation.angle, tilt: orientation.tilt };

const cloneHealth = (health: HealthState): HealthState => ({
  current: health.current,
  max: health.max,
});

const cloneCombatStatus = (
  status: SharedPlayerState["combatStatus"],
): SharedPlayerState["combatStatus"] => ({
  state: status.state,
  targetPlayerId: status.targetPlayerId,
  targetObjectId: status.targetObjectId,
  lastAttackAt: status.lastAttackAt,
});

const cloneCombatAttributes = (
  attributes: SharedPlayerState["combatAttributes"],
): SharedPlayerState["combatAttributes"] => ({
  attack: attributes.attack,
  defense: attributes.defense,
  speed: attributes.speed,
  range: attributes.range,
});

const clonePlayer = (player: SharedPlayerState): SharedPlayerState => ({
  ...player,
  skillList: Array.isArray(player.skillList) ? player.skillList.slice() : [],
  skillCooldowns:
    player.skillCooldowns && typeof player.skillCooldowns === "object"
      ? { ...player.skillCooldowns }
      : {},
  position: cloneVector(player.position),
  movementVector: cloneVector(player.movementVector),
  orientation: cloneOrientation(player.orientation),
  health: cloneHealth(player.health),
  combatStatus: cloneCombatStatus(player.combatStatus),
  combatAttributes: cloneCombatAttributes(player.combatAttributes),
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

const cloneProgressionStream = (stream: SharedProgressionStream): SharedProgressionStream => ({
  sequence: typeof stream.sequence === "number" ? stream.sequence : 0,
  dropPity: stream.dropPity ? { ...stream.dropPity } : undefined,
  damage: stream.damage ? stream.damage.map((entry) => ({ ...entry })) : undefined,
  objectives: stream.objectives ? stream.objectives.map((entry) => ({ ...entry })) : undefined,
  kills: stream.kills ? stream.kills.map((entry) => ({ ...entry })) : undefined,
});

const cloneProgressionState = (
  state?: SharedProgressionState | null,
): SharedProgressionState => {
  if (!state || typeof state !== "object") {
    return { players: {} };
  }

  const players: SharedProgressionState["players"] = {};
  for (const [playerId, stream] of Object.entries(state.players ?? {})) {
    players[playerId] = cloneProgressionStream(stream as SharedProgressionStream);
  }

  return { players };
};

const createEmptySynchronizedState = () => {
  const remotePlayers = createEmptyEntityCollection<SharedPlayerState>();
  const worldCollections = createEmptyWorldCollections();
  return {
    remotePlayers,
    microorganisms: worldCollections.microorganisms,
    organicMatter: worldCollections.organicMatter,
    obstacles: worldCollections.obstacles,
    roomObjects: worldCollections.roomObjects,
    world: buildWorldFromCollections(worldCollections),
    progression: cloneProgressionState(),
  };
};

const emptySyncState = createEmptySynchronizedState();

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
  players: emptySyncState.remotePlayers.byId,
  remotePlayers: emptySyncState.remotePlayers,
  ranking: [],
  microorganisms: emptySyncState.microorganisms,
  organicMatter: emptySyncState.organicMatter,
  obstacles: emptySyncState.obstacles,
  roomObjects: emptySyncState.roomObjects,
  world: emptySyncState.world,
  progression: cloneProgressionState(emptySyncState.progression),
  statusEffects: [],
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

const isFullState = (
  state: SharedGameState | SharedGameStateDiff
): state is SharedGameState => Array.isArray((state as SharedGameState).players);

const deriveRoomFromState = (
  state: SharedGameState | SharedGameStateDiff,
  previousRoom: RoomStateSnapshot,
): RoomStateSnapshot => {
  if (isFullState(state)) {
    if (
      previousRoom.phase === state.phase &&
      previousRoom.roundId === state.roundId &&
      previousRoom.roundStartedAt === state.roundStartedAt &&
      previousRoom.roundEndsAt === state.roundEndsAt
    ) {
      return previousRoom;
    }

    return {
      phase: state.phase,
      roundId: state.roundId,
      roundStartedAt: state.roundStartedAt,
      roundEndsAt: state.roundEndsAt,
    };
  }

  let nextRoom: RoomStateSnapshot | null = null;

  if (state.phase !== undefined && state.phase !== previousRoom.phase) {
    nextRoom = nextRoom ?? { ...previousRoom };
    nextRoom.phase = state.phase;
  }

  if (state.roundId !== undefined && state.roundId !== previousRoom.roundId) {
    nextRoom = nextRoom ?? { ...previousRoom };
    nextRoom.roundId = state.roundId;
  }

  if (
    state.roundStartedAt !== undefined &&
    state.roundStartedAt !== previousRoom.roundStartedAt
  ) {
    nextRoom = nextRoom ?? { ...previousRoom };
    nextRoom.roundStartedAt = state.roundStartedAt;
  }

  if (state.roundEndsAt !== undefined && state.roundEndsAt !== previousRoom.roundEndsAt) {
    nextRoom = nextRoom ?? { ...previousRoom };
    nextRoom.roundEndsAt = state.roundEndsAt;
  }

  return nextRoom ?? previousRoom;
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
  const derived = deriveSynchronizedStateFromFullSnapshot(state);
  applyState((prev) => ({
    ...prev,
    ...derived,
    statusEffects: [],
  }));
};

const applyStateDiff = (diff: SharedGameStateDiff) => {
  applyState((prev) => {
    const nextRoom = deriveRoomFromState(diff, prev.room);

    const playersResult = applyEntityCollectionDiff(
      prev.remotePlayers,
      diff.upsertPlayers,
      diff.removedPlayerIds,
      clonePlayer,
    );

    const worldDiff = diff.world;
    const microorganismsResult = applyEntityCollectionDiff(
      prev.microorganisms,
      worldDiff?.upsertMicroorganisms,
      worldDiff?.removeMicroorganismIds,
      cloneMicroorganism,
    );
    const organicMatterResult = applyEntityCollectionDiff(
      prev.organicMatter,
      worldDiff?.upsertOrganicMatter,
      worldDiff?.removeOrganicMatterIds,
      cloneOrganicMatter,
    );
    const obstacleResult = applyEntityCollectionDiff(
      prev.obstacles,
      worldDiff?.upsertObstacles,
      worldDiff?.removeObstacleIds,
      cloneObstacle,
    );
    const roomObjectResult = applyEntityCollectionDiff(
      prev.roomObjects,
      worldDiff?.upsertRoomObjects,
      worldDiff?.removeRoomObjectIds,
      cloneRoomObject,
    );

    let nextProgression = prev.progression;
    let progressionChanged = false;

    if (diff.progression?.players) {
      const updatedPlayers: SharedProgressionState["players"] = { ...prev.progression.players };
      for (const [playerId, stream] of Object.entries(diff.progression.players)) {
        if (stream) {
          updatedPlayers[playerId] = cloneProgressionStream(stream);
          progressionChanged = true;
          continue;
        }

        if (stream === null && updatedPlayers[playerId] !== undefined) {
          delete updatedPlayers[playerId];
          progressionChanged = true;
        }
      }
      if (progressionChanged) {
        nextProgression = { players: updatedPlayers };
      }
    }

    if (diff.removedPlayerIds && diff.removedPlayerIds.length > 0) {
      const entries = nextProgression === prev.progression
        ? { ...prev.progression.players }
        : { ...nextProgression.players };
      let removed = false;
      for (const id of diff.removedPlayerIds) {
        if (entries[id] !== undefined) {
          delete entries[id];
          removed = true;
        }
      }
      if (removed) {
        nextProgression = { players: entries };
        progressionChanged = true;
      } else if (nextProgression !== prev.progression) {
        nextProgression = { players: { ...nextProgression.players } };
      }
    }

    const worldChanged =
      microorganismsResult.changed ||
      organicMatterResult.changed ||
      obstacleResult.changed ||
      roomObjectResult.changed;

    const stateChanged =
      nextRoom !== prev.room ||
      playersResult.changed ||
      worldChanged ||
      progressionChanged;

    if (!stateChanged) {
      return prev;
    }

    const nextWorld = worldChanged
      ? buildWorldFromCollections({
          microorganisms: microorganismsResult.next,
          organicMatter: organicMatterResult.next,
          obstacles: obstacleResult.next,
          roomObjects: roomObjectResult.next,
        })
      : prev.world;

    return {
      ...prev,
      room: nextRoom,
      players: playersResult.changed ? playersResult.next.byId : prev.players,
      remotePlayers: playersResult.changed ? playersResult.next : prev.remotePlayers,
      microorganisms: microorganismsResult.next,
      organicMatter: organicMatterResult.next,
      obstacles: obstacleResult.next,
      roomObjects: roomObjectResult.next,
      world: nextWorld,
      progression: progressionChanged ? nextProgression : prev.progression,
      statusEffects: worldDiff?.statusEffects
        ? worldDiff.statusEffects.map((event) => ({ ...event }))
        : prev.statusEffects,
    };
  });
};

const areRankingsEqual = (a: RankingEntry[], b: RankingEntry[]) => {
  if (a === b) {
    return true;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.playerId !== right.playerId ||
      left.name !== right.name ||
      left.score !== right.score
    ) {
      return false;
    }
  }

  return true;
};

const applyRanking = (ranking: RankingEntry[]) => {
  applyState((prev) => {
    if (areRankingsEqual(prev.ranking, ranking)) {
      return prev;
    }

    return {
      ...prev,
      ranking,
    };
  });
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
  applyState(() => {
    const emptyState = createEmptySynchronizedState();
    return {
      ...initialState,
      playerName: preservedName,
      playerId: preservedId,
      connectionStatus: preservedStatus,
      reconnectUntil: preservedReconnectUntil,
      players: emptyState.remotePlayers.byId,
      remotePlayers: emptyState.remotePlayers,
      microorganisms: emptyState.microorganisms,
      organicMatter: emptyState.organicMatter,
      obstacles: emptyState.obstacles,
      roomObjects: emptyState.roomObjects,
      world: emptyState.world,
      statusEffects: [],
    };
  });
};

const applyJoinedSnapshot = ({
  playerId,
  playerName,
  reconnectUntil,
  state,
  ranking,
}: {
  playerId: string;
  playerName: string;
  reconnectUntil: number | null;
  state: SharedGameState;
  ranking: RankingEntry[];
}) => {
  const derived = deriveSynchronizedStateFromFullSnapshot(state);
  applyState(() => ({
    connectionStatus: "connected",
    reconnectAttempts: 0,
    reconnectUntil,
    playerId,
    playerName,
    joinError: null,
    lastPingAt: null,
    lastPongAt: null,
    ranking,
    statusEffects: [],
    ...derived,
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
    applyJoinedSnapshot,
  },
};

type EqualityChecker<T> = (a: T, b: T) => boolean;

const defaultEquality: EqualityChecker<unknown> = (a, b) => Object.is(a, b);

export function useGameStore<T>(
  selector: StateSelector<T>,
  isEqual: EqualityChecker<T> = defaultEquality as EqualityChecker<T>,
): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const lastStateRef = useRef<GameStoreState>(currentState);
  const lastSelectionRef = useRef<T>(selector(currentState));

  const getSnapshot = () => {
    const nextState = currentState;
    if (lastStateRef.current === nextState) {
      return lastSelectionRef.current;
    }

    const nextSelection = selectorRef.current(nextState);
    if (isEqual(nextSelection, lastSelectionRef.current)) {
      lastStateRef.current = nextState;
      return lastSelectionRef.current;
    }

    lastStateRef.current = nextState;
    lastSelectionRef.current = nextSelection;
    return nextSelection;
  };

  const getServerSnapshot = () => selectorRef.current(initialState);

  return useSyncExternalStore(gameStore.subscribe, getSnapshot, getServerSnapshot);
}
