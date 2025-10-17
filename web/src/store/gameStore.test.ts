import { beforeEach, describe, expect, it } from "vitest";
import { gameStore, type GameStoreState } from "./gameStore";
import type {
  RankingEntry,
  SharedGameState,
  SharedGameStateDiff,
  SharedPlayerState,
  SharedWorldState,
} from "../utils/messageTypes";

const baseState = gameStore.getState();

const createWorld = (): SharedWorldState => ({
  microorganisms: [],
  organicMatter: [],
  obstacles: [],
  roomObjects: [],
});

const createPlayerState = (
  overrides: Partial<SharedPlayerState> & Pick<SharedPlayerState, "id" | "name">
): SharedPlayerState => ({
  id: overrides.id,
  name: overrides.name,
  connected: overrides.connected ?? true,
  score: overrides.score ?? 0,
  combo: overrides.combo ?? 1,
  energy: overrides.energy ?? 0,
  xp: overrides.xp ?? 0,
  geneticMaterial: overrides.geneticMaterial ?? 0,
  lastActiveAt: overrides.lastActiveAt ?? 0,
  position: overrides.position ?? { x: 0, y: 0 },
  movementVector: overrides.movementVector ?? { x: 0, y: 0 },
  orientation: overrides.orientation ?? { angle: 0 },
  health: overrides.health ?? { current: 100, max: 100 },
  combatStatus:
    overrides.combatStatus ?? {
      state: "idle",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: null,
    },
  combatAttributes:
    overrides.combatAttributes ?? {
      attack: 1,
      defense: 1,
      speed: 1,
      range: 1,
    },
  archetype: overrides.archetype ?? null,
  archetypeKey: overrides.archetypeKey ?? null,
  skillList: overrides.skillList ?? [],
  currentSkill: overrides.currentSkill ?? null,
  skillCooldowns: overrides.skillCooldowns ?? {},
});

const createEmptyCollection = <T extends { id: string }>(): {
  byId: Record<string, T>;
  all: T[];
  indexById: Map<string, number>;
} => ({ byId: {}, all: [], indexById: new Map() });

const createFreshState = (): GameStoreState => {
  const emptyPlayers = createEmptyCollection<SharedPlayerState>();
  const emptyMicroorganisms = createEmptyCollection<SharedWorldState["microorganisms"][number]>();
  const emptyOrganic = createEmptyCollection<SharedWorldState["organicMatter"][number]>();
  const emptyObstacles = createEmptyCollection<SharedWorldState["obstacles"][number]>();
  const emptyRoomObjects = createEmptyCollection<SharedWorldState["roomObjects"][number]>();

  return {
    ...baseState,
    room: { ...baseState.room },
    players: emptyPlayers.byId,
    remotePlayers: emptyPlayers,
    ranking: [],
    microorganisms: emptyMicroorganisms,
    organicMatter: emptyOrganic,
    obstacles: emptyObstacles,
    roomObjects: emptyRoomObjects,
    connectionStatus: "idle",
    reconnectAttempts: 0,
    reconnectUntil: null,
    playerId: null,
    playerName: null,
    joinError: null,
    lastPingAt: null,
    lastPongAt: null,
    world: {
      microorganisms: emptyMicroorganisms.all,
      organicMatter: emptyOrganic.all,
      obstacles: emptyObstacles.all,
      roomObjects: emptyRoomObjects.all,
    },
    progression: { players: {} },
  };
};

beforeEach(() => {
  gameStore.setState(() => createFreshState());
});

describe("gameStore", () => {
  it("applies full state snapshots and merges subsequent diffs", () => {
    const microorganism = {
      id: "micro-1",
      kind: "microorganism" as const,
      species: "amoeba",
      position: { x: 1, y: 1 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 4, max: 10 },
      aggression: "neutral" as const,
      attributes: {},
    };

    const fullWorld = createWorld();
    fullWorld.microorganisms.push(microorganism);

    const fullState: SharedGameState = {
      phase: "active",
      roundId: "round-1",
      roundStartedAt: 1000,
      roundEndsAt: 2000,
      players: [
        createPlayerState({
          id: "p1",
          name: "Alice",
          score: 10,
          combo: 1,
          lastActiveAt: 1000,
          position: { x: 1, y: 1 },
          health: { current: 95, max: 100 },
        }),
      ],
      world: fullWorld,
    };

    gameStore.actions.applyFullState(fullState);

    const afterFull = gameStore.getState();
    expect(afterFull.room).toEqual({
      phase: "active",
      roundId: "round-1",
      roundStartedAt: 1000,
      roundEndsAt: 2000,
    });
    expect(afterFull.players).toHaveProperty("p1");
    expect(afterFull.players.p1?.name).toBe("Alice");
    expect(afterFull.remotePlayers.all).toHaveLength(1);
    expect(afterFull.remotePlayers.byId.p1?.position).toEqual({ x: 1, y: 1 });
    expect(afterFull.world.microorganisms).toHaveLength(1);
    expect(afterFull.world.microorganisms[0]).toMatchObject({ id: "micro-1", species: "amoeba" });
    expect(afterFull.microorganisms.all).toHaveLength(1);

    const diff: SharedGameStateDiff = {
      upsertPlayers: [
        createPlayerState({
          id: "p1",
          name: "Alice",
          score: 250,
          combo: 3,
          lastActiveAt: 1500,
          position: { x: 5, y: 5 },
          movementVector: { x: 1, y: 0 },
          orientation: { angle: Math.PI / 2 },
          health: { current: 80, max: 100 },
          combatStatus: {
            state: "engaged",
            targetPlayerId: "p2",
            targetObjectId: null,
            lastAttackAt: 1500,
          },
        }),
      ],
      world: {
        upsertOrganicMatter: [
          {
            id: "om-1",
            kind: "organic_matter" as const,
            position: { x: 3, y: 4 },
            quantity: 12,
            nutrients: { protein: 5 },
          },
        ],
        removeMicroorganismIds: ["micro-1"],
      },
    };

    gameStore.actions.applyStateDiff(diff);

    const updated = gameStore.getState();
    expect(updated.players.p1?.score).toBe(250);
    expect(updated.players.p1?.combo).toBe(3);
    expect(updated.players.p1?.combatStatus.state).toBe("engaged");
    expect(updated.remotePlayers.byId.p1?.movementVector).toEqual({ x: 1, y: 0 });
    expect(updated.remotePlayers.all[0]?.orientation).toEqual({ angle: Math.PI / 2 });
    expect(updated.world.microorganisms).toHaveLength(0);
    expect(updated.world.organicMatter).toEqual([
      {
        id: "om-1",
        kind: "organic_matter",
        position: { x: 3, y: 4 },
        quantity: 12,
        nutrients: { protein: 5 },
      },
    ]);
    expect(updated.microorganisms.all).toHaveLength(0);
    expect(updated.organicMatter.all).toHaveLength(1);

    gameStore.actions.applyStateDiff({ removedPlayerIds: ["p1"] });
    expect(gameStore.getState().players.p1).toBeUndefined();
    expect(gameStore.getState().remotePlayers.all).toHaveLength(0);
  });

  it("retains previous world data during reconnection until the new joined snapshot arrives", () => {
    const oldPlayer = createPlayerState({ id: "p-old", name: "Veteran" });
    const oldWorld = createWorld();
    oldWorld.microorganisms.push({
      id: "micro-old",
      kind: "microorganism" as const,
      species: "amoeba",
      position: { x: 2, y: 2 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 8, max: 10 },
      aggression: "neutral" as const,
      attributes: {},
    });

    const oldState: SharedGameState = {
      phase: "active",
      roundId: "round-old",
      roundStartedAt: 100,
      roundEndsAt: 200,
      players: [oldPlayer],
      world: oldWorld,
    };

    const oldRanking: RankingEntry[] = [
      { playerId: "p-old", name: "Veteran", score: 15, combo: 2 },
    ];

    gameStore.actions.applyFullState(oldState);
    gameStore.actions.applyRanking(oldRanking);
    gameStore.actions.setPlayerId("p-old");
    gameStore.actions.setPlayerName("Veteran");
    gameStore.actions.setConnectionStatus("connected");

    const beforeReconnect = gameStore.getState();
    expect(beforeReconnect.connectionStatus).toBe("connected");
    expect(beforeReconnect.players).toHaveProperty("p-old");
    expect(beforeReconnect.world.microorganisms).toHaveLength(1);

    gameStore.actions.setConnectionStatus("reconnecting");

    const whileReconnecting = gameStore.getState();
    expect(whileReconnecting.connectionStatus).toBe("reconnecting");
    expect(whileReconnecting.players).toHaveProperty("p-old");
    expect(whileReconnecting.world.microorganisms[0]?.id).toBe("micro-old");
    expect(whileReconnecting.ranking).toEqual(oldRanking);

    const newPlayer = createPlayerState({ id: "p-new", name: "Rookie", score: 30 });
    const newWorld = createWorld();
    newWorld.microorganisms.push({
      id: "micro-new",
      kind: "microorganism" as const,
      species: "paramecium",
      position: { x: 5, y: 5 },
      movementVector: { x: 1, y: 1 },
      orientation: { angle: Math.PI / 2 },
      health: { current: 6, max: 12 },
      aggression: "passive" as const,
      attributes: { speed: 2 },
    });

    const newState: SharedGameState = {
      phase: "active",
      roundId: "round-new",
      roundStartedAt: 300,
      roundEndsAt: 600,
      players: [newPlayer],
      world: newWorld,
    };

    const newRanking: RankingEntry[] = [
      { playerId: "p-new", name: "Rookie", score: 30, combo: 1 },
    ];

    gameStore.actions.applyJoinedSnapshot({
      playerId: "p-new",
      playerName: "Rookie",
      reconnectUntil: 9999,
      state: newState,
      ranking: newRanking,
    });

    const afterJoined = gameStore.getState();
    expect(afterJoined.connectionStatus).toBe("connected");
    expect(afterJoined.players).not.toHaveProperty("p-old");
    expect(afterJoined.players).toHaveProperty("p-new");
    expect(afterJoined.world.microorganisms[0]?.id).toBe("micro-new");
    expect(afterJoined.ranking).toEqual(newRanking);
    expect(afterJoined.joinError).toBeNull();
    expect(afterJoined.reconnectAttempts).toBe(0);
  });

  it("clears round metadata when diffs reset values", () => {
    const fullState: SharedGameState = {
      phase: "active",
      roundId: "round-42",
      roundStartedAt: 10_000,
      roundEndsAt: 20_000,
      players: [],
      world: createWorld(),
    };

    gameStore.actions.applyFullState(fullState);

    gameStore.actions.applyStateDiff({
      phase: "waiting",
      roundId: null,
      roundStartedAt: null,
      roundEndsAt: null,
    });

    expect(gameStore.getState().room).toEqual({
      phase: "waiting",
      roundId: null,
      roundStartedAt: null,
      roundEndsAt: null,
    });
  });

  it("tracks ranking payloads and connection lifecycle", () => {
    const ranking: RankingEntry[] = [
      { playerId: "p1", name: "Alice", score: 3200 },
      { playerId: "p2", name: "Bob", score: 2500 },
    ];

    gameStore.actions.applyRanking(ranking);

    expect(gameStore.getState().ranking).toEqual(ranking);

    gameStore.actions.setConnectionStatus("connecting");
    expect(gameStore.getState().connectionStatus).toBe("connecting");

    gameStore.actions.setJoinError("name_taken");
    expect(gameStore.getState().joinError).toBe("name_taken");

    const attempts = gameStore.actions.incrementReconnectAttempts();
    expect(attempts).toBe(1);
    expect(gameStore.getState().reconnectAttempts).toBe(1);

    gameStore.actions.setReconnectUntil(5000);
    expect(gameStore.getState().reconnectUntil).toBe(5000);

    gameStore.actions.markPing(1000);
    gameStore.actions.markPong(1200);
    expect(gameStore.getState().lastPingAt).toBe(1000);
    expect(gameStore.getState().lastPongAt).toBe(1200);
  });

  it("maintains index maps across partial entity updates", () => {
    const players = [
      createPlayerState({ id: "p1", name: "Alpha" }),
      createPlayerState({ id: "p2", name: "Beta" }),
      createPlayerState({ id: "p3", name: "Gamma" }),
    ];

    const world = createWorld();
    const fullState: SharedGameState = {
      phase: "active",
      roundId: "round-idx",
      roundStartedAt: 0,
      roundEndsAt: 10,
      players,
      world,
    };

    gameStore.actions.applyFullState(fullState);

    const snapshot = gameStore.getState();
    const initialPlayers = snapshot.remotePlayers;
    const originalIndexMap = initialPlayers.indexById;
    expect(originalIndexMap.get("p1")).toBe(0);
    expect(originalIndexMap.get("p2")).toBe(1);
    expect(originalIndexMap.get("p3")).toBe(2);

    gameStore.actions.applyStateDiff({
      upsertPlayers: [
        createPlayerState({ id: "p2", name: "Beta", score: 42 }),
      ],
    });

    const afterUpdate = gameStore.getState().remotePlayers;
    expect(afterUpdate.byId.p2?.score).toBe(42);
    expect(afterUpdate.indexById).toBe(originalIndexMap);
    expect(afterUpdate.indexById.get("p1")).toBe(0);
    expect(afterUpdate.indexById.get("p2")).toBe(1);
    expect(afterUpdate.indexById.get("p3")).toBe(2);
    expect(afterUpdate.all).toHaveLength(3);

    gameStore.actions.applyStateDiff({ removedPlayerIds: ["p2"] });

    const afterRemoval = gameStore.getState().remotePlayers;
    expect(afterRemoval.byId.p2).toBeUndefined();
    expect(afterRemoval.indexById).not.toBe(originalIndexMap);
    expect(afterRemoval.all).toHaveLength(2);
    expect(afterRemoval.indexById.get("p1")).toBe(0);
    expect(afterRemoval.indexById.get("p3")).toBe(1);
  });
});
